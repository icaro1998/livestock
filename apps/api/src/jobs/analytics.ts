import cron from "node-cron";
import { FastifyInstance } from "fastify";
import { computeDerivedMetrics } from "../services/analytics";

export const scheduleAnalytics = (fastify: FastifyInstance) => {
  const task = cron.schedule("*/10 * * * *", () => {
    computeDerivedMetrics(fastify).catch((err) => fastify.log.error({ err }, "analytics job failed"));
  });
  // run once at startup
  computeDerivedMetrics(fastify).catch((err) => fastify.log.error({ err }, "initial analytics failed"));
  fastify.addHook("onClose", async () => task.stop());
};
