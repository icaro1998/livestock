const main = async () => {
  process.env.DISABLE_ANALYTICS_JOBS = "true";
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  const { default: buildServer } = await import("../apps/api/src/index");
  const app = buildServer();
  try {
    await app.ready();
    // eslint-disable-next-line no-console
    console.log("Fastify booted successfully");
    // eslint-disable-next-line no-console
    console.log(app.printRoutes());
    process.exitCode = 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Fastify failed to boot:", err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
};

main();
