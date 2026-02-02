import buildServer from "../apps/api/src/index";

const main = async () => {
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
