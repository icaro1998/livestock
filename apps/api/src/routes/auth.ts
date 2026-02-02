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

  fastify.post(
    "/auth/register",
    {
      preHandler: preRegister,
      schema: {
        tags: ["Auth"],
        summary: "Register user",
        body: {
          type: "object",
          required: ["email", "password", "role"],
          additionalProperties: true,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            role: { type: "string", enum: ["admin", "manager", "viewer"] },
          },
        },
        response: {
          201: {
            type: "object",
            additionalProperties: false,
            required: ["id", "email", "role"],
            properties: {
              id: { type: "number" },
              email: { type: "string" },
              role: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.parse(request.body);
      const user = await registerUser(fastify, parsed);
      reply.code(201).send({ id: Number(user.id), email: user.email, role: user.role });
    }
  );

  fastify.post(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login",
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: true,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["accessToken", "refreshToken", "user", "expires_at"],
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
              expires_at: { type: "string", format: "date-time" },
              user: {
                type: "object",
                additionalProperties: false,
                required: ["id", "email", "role"],
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  fastify.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Refresh tokens",
        body: {
          type: "object",
          required: ["refreshToken"],
          additionalProperties: true,
          properties: {
            refreshToken: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["accessToken", "refreshToken", "user"],
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
              user: {
                type: "object",
                additionalProperties: false,
                required: ["id", "email", "role"],
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const token = (request.body as any)?.refreshToken;
      if (!token) throw new ApiError(400, "refreshToken required");
      const { accessToken, refreshToken, user } = await refreshUser(fastify, token);
      reply.send({ accessToken, refreshToken, user: { id: Number(user.id), email: user.email, role: user.role } });
    }
  );
}
