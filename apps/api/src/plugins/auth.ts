import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { roleAllows, Role } from "@livestock/shared";

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: fastify.config.jwtAccessSecret,
    sign: { expiresIn: fastify.config.jwtAccessExpires },
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      const payload = (await request.jwtVerify()) as { id: number; role: Role; email: string };
      request.user = { id: BigInt(payload.id), role: payload.role, email: payload.email };
    } catch (err) {
      reply.code(401).send({ message: "Unauthorized" });
      return reply;
    }
  });

  fastify.decorate("authorize", (required: Role) => async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (!request.user || reply.sent) return reply;
    const user = request.user as { role: Role };
    if (!roleAllows(user.role, required)) {
      reply.code(403).send({ message: "Forbidden" });
      return reply;
    }
  });
});
