import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config";
import { prisma } from "@livestock/db";
import requestIdPlugin from "./plugins/request-id";
import redisPlugin from "./plugins/redis";
import authPlugin from "./plugins/auth";
import openapiPlugin from "./plugins/openapi";
import wsPlugin from "./plugins/ws";
import authRoutes from "./routes/auth";
import animalRoutes from "./routes/animals";
import eventRoutes from "./routes/events";
import costRoutes from "./routes/costs";
import dimensionRoutes from "./routes/dimensions";
import analyticsRoutes from "./routes/analytics";
import systemRoutes from "./routes/system";
import { scheduleAnalytics } from "./jobs/analytics";
import { ApiError, isApiError } from "./utils/errors";
import { ZodError } from "zod";

const buildServer = () => {
  const fastify = Fastify({
    logger: { level: config.env === "development" ? "debug" : "info" },
    trustProxy: true,
  });

  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (typeof body !== "string") return done(null, body);
    const trimmed = body.trim().replace(/^\uFEFF/, "");
    const unescapeQuotes = (value: string) => value.replace(/\\+"/g, '"');
    const candidates: string[] = [trimmed];

    if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
      candidates.unshift(trimmed.slice(1, -1));
    }
    if (trimmed.includes("\\\"")) {
      candidates.unshift(unescapeQuotes(trimmed));
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed === "string") {
          try {
            return done(null, JSON.parse(parsed));
          } catch {}
        }
        return done(null, parsed);
      } catch {}
    }
    done(new SyntaxError("Invalid JSON body"));
  });
  fastify.decorate("config", config);
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  fastify.register(requestIdPlugin);
  fastify.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin });
  fastify.register(rateLimit, config.rateLimit);
  fastify.register(redisPlugin);
  fastify.register(authPlugin);
  fastify.register(openapiPlugin);
  fastify.register(wsPlugin);

  // normalize BigInt values in responses
  fastify.addHook("preSerialization", (_request, _reply, payload, done) => {
    if (payload === null || payload === undefined) return done(null, payload);
    try {
      const normalized = JSON.parse(
        JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
      );
      done(null, normalized);
    } catch (err) {
      done(err as Error);
    }
  });

  fastify.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      reply.code(error.statusCode).send({ message: error.message, details: error.details });
      return;
    }
    if (error instanceof ZodError) {
      reply.code(400).send({ message: "Validation error", details: error.errors });
      return;
    }
    if (error instanceof SyntaxError) {
      reply.code(400).send({ message: "Invalid JSON body" });
      return;
    }    if (error instanceof SyntaxError) {
      reply.code(400).send({ message: "Invalid JSON body" });
      return;
    }

    const statusCode = typeof (error as any).statusCode === "number" ? (error as any).statusCode : undefined;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const isInvalidJson = (error as any).code === "FST_ERR_CTP_INVALID_BODY";
      reply.code(statusCode).send({ message: isInvalidJson ? "Invalid JSON body" : error.message });
      return;
    }

    fastify.log.error(error);
    reply.code(500).send({ message: "Internal Server Error" });
  });

  fastify.register(systemRoutes);
  fastify.register(authRoutes);
  fastify.register(animalRoutes);
  fastify.register(eventRoutes);
  fastify.register(costRoutes);
  fastify.register(dimensionRoutes);
  fastify.register(analyticsRoutes);

  scheduleAnalytics(fastify);

  return fastify;
};

const start = async () => {
  const app = buildServer();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`API listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export default buildServer;

