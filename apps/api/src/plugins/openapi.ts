import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export default fp(async (fastify) => {
  if (!fastify.config.openapiEnabled) return;
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "GANADERÍA AVANZADA API",
        version: "0.1.0",
      },
      servers: [{ url: "/" }],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  });
});
