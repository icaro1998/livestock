import fp from "fastify-plugin";
import { v4 as uuid } from "uuid";

export default fp(async (fastify) => {
  fastify.addHook("onRequest", async (req, reply) => {
    const incoming = req.headers["x-request-id"] as string | undefined;
    const id = incoming || uuid();
    req.id = id;
    reply.header("x-request-id", id);
  });
});
