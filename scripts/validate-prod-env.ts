const main = async () => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }
  if (process.env.NODE_ENV !== "production") {
    console.error("NODE_ENV was not set to production. Re-run with NODE_ENV=production.");
    process.exit(1);
  }

  try {
    await import("../apps/api/src/config");
    console.log("Production config validation passed.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
};

main();
