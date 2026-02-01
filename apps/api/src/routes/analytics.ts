import { FastifyInstance } from "fastify";
import { computeDerivedMetrics } from "../services/analytics";
import { ApiError } from "../utils/errors";

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.get("/dashboards/summary", { preHandler: fastify.authorize("viewer") }, async (_req, reply) => {
    const cached = await fastify.redis.get("metrics:summary");
    if (cached) return reply.send(JSON.parse(cached));
    await computeDerivedMetrics(fastify);
    const summary = await fastify.prisma.derivedMetric.findFirst({ where: { kind: "summary" }, orderBy: { computed_at: "desc" } });
    reply.send(summary?.data || {});
  });

  fastify.get("/animals/:uid/metrics", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const uid = (request.params as any).uid as string;
    const metric = await fastify.prisma.derivedMetric.findFirst({ where: { kind: "animal_metrics", uid }, orderBy: { computed_at: "desc" } });
    if (!metric) throw new ApiError(404, "Metrics not found");
    reply.send(metric.data);
  });
}
