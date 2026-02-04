import fp from "fastify-plugin";
import { v4 as uuid } from "uuid";

export default fp(async (fastify) => {
  fastify.addHook("onRequest", async (req, reply) => {
    const incoming = req.headers["x-request-id"] as string | undefined;
    const id = incoming || uuid();
    req.id = id;
    reply.header("x-request-id", id);
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const user = request.user as { id?: bigint; role?: string; email?: string } | undefined;
    const route = request.routeOptions?.url || request.url;
    const payload: Record<string, unknown> = {
      route,
      method: request.method,
      statusCode: reply.statusCode,
    };
    if (typeof (reply as any).elapsedTime === "number") {
      payload.responseTimeMs = (reply as any).elapsedTime;
    }
    if (user) {
      payload.userId = user.id !== undefined ? Number(user.id) : undefined;
      payload.role = user.role;
      payload.email = user.email;
    }
    request.log.info(payload, "request completed");
  });
});
