import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { ApiError } from "../utils/errors";
import { Role } from "@livestock/shared";
import crypto from "node:crypto";

const ACCESS_PAYLOAD_FIELDS = ["id", "role", "email"] as const;
const hashRefreshToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const isBcryptHash = (value: string) => value.startsWith("$2") && value.length >= 59;

type UserPayload = { id: bigint; role: Role; email: string };

export const registerUser = async (
  fastify: FastifyInstance,
  input: { email: string; password: string; role: Role }
) => {
  const exists = await fastify.prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "User already exists");
  const hash = await bcrypt.hash(input.password, 10);
  const user = await fastify.prisma.user.create({
    data: { email: input.email, password: hash, role: input.role },
  });
  return user;
};

const buildTokens = async (fastify: FastifyInstance, user: { id: bigint; role: Role; email: string }) => {
  const accessToken = fastify.jwt.sign(
    { id: Number(user.id), role: user.role, email: user.email },
    { expiresIn: fastify.config.jwtAccessExpires }
  );
  const refreshToken = fastify.jwt.sign(
    { id: Number(user.id), role: user.role, email: user.email, jti: crypto.randomUUID() },
    { key: fastify.config.jwtRefreshSecret, expiresIn: fastify.config.jwtRefreshExpires }
  );
  const decoded: any = fastify.jwt.decode(refreshToken);
  const exp = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 86400_000);
  const hashed = hashRefreshToken(refreshToken);
  const stored = await fastify.prisma.refreshToken.create({
    data: {
      token: hashed,
      user_id: BigInt(user.id),
      expires_at: exp,
    },
    select: { id: true },
  });
  return { accessToken, refreshToken, expires_at: exp, refreshTokenId: stored.id };
};

export const loginUser = async (fastify: FastifyInstance, email: string, password: string) => {
  const user = await fastify.prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "Invalid credentials");
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, "Invalid credentials");
  await fastify.prisma.refreshToken.deleteMany({
    where: { user_id: user.id, OR: [{ revoked: true }, { expires_at: { lt: new Date() } }] },
  });
  const tokens = await buildTokens(fastify, { id: user.id, role: user.role as Role, email: user.email });
  return { user, ...tokens };
};

export const refreshUser = async (fastify: FastifyInstance, refreshToken: string) => {
  let payload: any;
  try {
    payload = fastify.jwt.verify(refreshToken, { key: fastify.config.jwtRefreshSecret });
  } catch (err) {
    throw new ApiError(401, "Invalid refresh token");
  }
  const user = await fastify.prisma.user.findUnique({ where: { id: BigInt(payload.id) } });
  if (!user) throw new ApiError(401, "User not found");
  await fastify.prisma.refreshToken.deleteMany({
    where: { user_id: user.id, OR: [{ revoked: true }, { expires_at: { lt: new Date() } }] },
  });
  const tokenHash = hashRefreshToken(refreshToken);
  let matched: { id: bigint; expires_at: Date }[] = [];
  const stored = await fastify.prisma.refreshToken.findFirst({
    where: { user_id: user.id, revoked: false, token: tokenHash },
    select: { id: true, expires_at: true },
  });
  if (stored) {
    matched = [stored];
  } else {
    const tokens = await fastify.prisma.refreshToken.findMany({
      where: { user_id: user.id, revoked: false },
      orderBy: { created_at: "desc" },
    });
    for (const t of tokens) {
      if (isBcryptHash(t.token) && (await bcrypt.compare(refreshToken, t.token))) {
        matched.push({ id: t.id, expires_at: t.expires_at });
      }
    }
  }
  if (!matched.length) throw new ApiError(401, "Refresh token revoked or missing");
  if (matched.some((token) => token.expires_at.getTime() < Date.now())) {
    throw new ApiError(401, "Refresh token expired");
  }
  // rotate: mark all matching tokens revoked (handles duplicates)
  await fastify.prisma.refreshToken.updateMany({
    where: { id: { in: matched.map((t) => t.id) } },
    data: { revoked: true },
  });
  const newTokens = await buildTokens(fastify, { id: user.id, role: user.role as Role, email: user.email });
  await fastify.prisma.refreshToken.updateMany({
    where: { user_id: user.id, revoked: false, id: { not: newTokens.refreshTokenId } },
    data: { revoked: true },
  });
  return { user, accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken, expires_at: newTokens.expires_at };
};

export const ensureBootstrapPossible = async (fastify: FastifyInstance) => {
  const count = await fastify.prisma.user.count();
  return count === 0 || fastify.config.bootstrapAdmin;
};
