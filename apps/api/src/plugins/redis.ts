import fp from "fastify-plugin";
import Redis from "ioredis";

export default fp(async (fastify) => {
  const redis = new Redis(fastify.config.redisUrl, { lazyConnect: false });
  const subscriber = new Redis(fastify.config.redisUrl, { lazyConnect: false, enableReadyCheck: false });

  redis.on("error", (err) => fastify.log.error({ err }, "redis error"));
  subscriber.on("error", (err) => fastify.log.error({ err }, "redis sub error"));

  fastify.decorate("redis", redis);
  fastify.decorate("redisSubscriber", subscriber);

  fastify.addHook("onClose", async () => {
    await redis.quit();
    await subscriber.quit();
  });
});