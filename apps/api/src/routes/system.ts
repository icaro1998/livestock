import { FastifyInstance } from "fastify";
import pkg from "../../package.json";

export default async function systemRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/healthz",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: { status: { type: "string" } },
          },
        },
      },
    },
    async () => ({ status: "ok" })
  );

  fastify.get(
    "/readyz",
    {
      schema: {
        tags: ["System"],
        summary: "Readiness check",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: { status: { type: "string" } },
          },
          500: {
            type: "object",
            additionalProperties: false,
            required: ["status", "err"],
            properties: { status: { type: "string" }, err: { type: "string" } },
          },
        },
      },
    },
    async (_, reply) => {
      try {
        await fastify.prisma.$queryRaw`SELECT 1`;
        await fastify.redis.ping();
        reply.send({ status: "ready" });
      } catch (err) {
        reply.code(500).send({ status: "not_ready", err: (err as Error).message });
      }
    }
  );

  fastify.get(
    "/metrics",
    {
      schema: {
        tags: ["System"],
        summary: "Process metrics",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["uptime_sec", "rss", "heapUsed", "heapTotal"],
            properties: {
              uptime_sec: { type: "number" },
              rss: { type: "number" },
              heapUsed: { type: "number" },
              heapTotal: { type: "number" },
            },
          },
        },
      },
    },
    async () => {
      const mem = process.memoryUsage();
      return {
        uptime_sec: process.uptime(),
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      };
    }
  );

  fastify.get(
    "/info",
    {
      schema: {
        tags: ["System"],
        summary: "Service info",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["name", "version", "env"],
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              env: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({
      name: pkg.name,
      version: pkg.version,
      env: process.env.NODE_ENV || "development",
    })
  );
}
