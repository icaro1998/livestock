import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { ApiError } from "../utils/errors";
import { Role } from "@livestock/shared";

const ACCESS_PAYLOAD_FIELDS = ["id", "role", "email"] as const;

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
    { id: Number(user.id), role: user.role, email: user.email },
    { key: fastify.config.jwtRefreshSecret, expiresIn: fastify.config.jwtRefreshExpires }
  );
  const decoded: any = fastify.jwt.decode(refreshToken);
  const exp = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 86400_000);
  const hashed = await bcrypt.hash(refreshToken, 10);
  await fastify.prisma.refreshToken.create({
    data: {
      token: hashed,
      user_id: BigInt(user.id),
      expires_at: exp,
    },
  });
  return { accessToken, refreshToken, expires_at: exp };
};

export const loginUser = async (fastify: FastifyInstance, email: string, password: string) => {
  const user = await fastify.prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "Invalid credentials");
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, "Invalid credentials");
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
  const tokens = await fastify.prisma.refreshToken.findMany({
    where: { user_id: user.id, revoked: false },
    orderBy: { created_at: "desc" },
  });
  let matched = null;
  for (const t of tokens) {
    if (await bcrypt.compare(refreshToken, t.token)) {
      matched = t;
      break;
    }
  }
  if (!matched) throw new ApiError(401, "Refresh token revoked or missing");
  if (matched.expires_at.getTime() < Date.now()) throw new ApiError(401, "Refresh token expired");
  // rotate: mark old token revoked
  await fastify.prisma.refreshToken.update({ where: { id: matched.id }, data: { revoked: true } });
  const newTokens = await buildTokens(fastify, { id: user.id, role: user.role as Role, email: user.email });
  return { user, ...newTokens };
};

export const ensureBootstrapPossible = async (fastify: FastifyInstance) => {
  const count = await fastify.prisma.user.count();
  return count === 0 || fastify.config.bootstrapAdmin;
};
