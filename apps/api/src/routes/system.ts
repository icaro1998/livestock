import { FastifyInstance } from "fastify";

export default async function systemRoutes(fastify: FastifyInstance) {
  fastify.get("/healthz", async () => ({ status: "ok" }));

  fastify.get("/readyz", async (_, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      await fastify.redis.ping();
      reply.send({ status: "ready" });
    } catch (err) {
      reply.code(500).send({ status: "not_ready", err: (err as Error).message });
    }
  });

  fastify.get("/metrics", async () => {
    const mem = process.memoryUsage();
    return {
      uptime_sec: process.uptime(),
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    };
  });
}
