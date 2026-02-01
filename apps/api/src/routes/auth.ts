import { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@livestock/shared";
import { loginUser, refreshUser, registerUser, ensureBootstrapPossible } from "../services/auth";
import { ApiError } from "../utils/errors";

export default async function authRoutes(fastify: FastifyInstance) {
  const preRegister = async (req: any, reply: any) => {
    const allowed = await ensureBootstrapPossible(fastify);
    if (!allowed) {
      await fastify.authorize("admin")(req, reply);
    }
  };

  fastify.post("/auth/register", { preHandler: preRegister }, async (request, reply) => {
    const parsed = registerSchema.parse(request.body);
    const user = await registerUser(fastify, parsed);
    reply.code(201).send({ id: Number(user.id), email: user.email, role: user.role });
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.parse(request.body);
    const { user, accessToken, refreshToken, expires_at } = await loginUser(
      fastify,
      parsed.email,
      parsed.password
    );
    reply.send({
      accessToken,
      refreshToken,
      user: { id: Number(user.id), email: user.email, role: user.role },
      expires_at,
    });
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const token = (request.body as any)?.refreshToken;
    if (!token) throw new ApiError(400, "refreshToken required");
    const { accessToken, refreshToken, user } = await refreshUser(fastify, token);
    reply.send({ accessToken, refreshToken, user: { id: Number(user.id), email: user.email, role: user.role } });
  });
}