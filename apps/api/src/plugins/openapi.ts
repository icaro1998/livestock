import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const publicRoutes = new Set([
  "/healthz",
  "/readyz",
  "/metrics",
  "/info",
  "/ws",
  "/auth/register",
  "/auth/login",
  "/auth/refresh",
  "/docs",
  "/docs/json",
  "/docs/yaml",
]);

export default fp(async (fastify) => {
  if (!fastify.config.openapiEnabled) return;

  // Add default responses and auth requirements for undocumented routes.
  fastify.addHook("onRoute", (route) => {
    route.schema = route.schema || {};
    if (!route.schema.response) {
      route.schema.response = {
        200: {
          description: "Default Response",
          type: "object",
          additionalProperties: true,
        },
      };
    }
    if (!route.schema.security && !publicRoutes.has(route.path)) {
      route.schema.security = [{ bearerAuth: [] }];
    }
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "GANADERIA AVANZADA API",
        version: "0.1.0",
      },
      tags: [
        { name: "System", description: "Health, readiness, metrics, and service info." },
        { name: "Auth", description: "Authentication and token lifecycle." },
        { name: "Animals", description: "Animal records and timelines." },
        { name: "Events", description: "Animal event ingestion and listing." },
        { name: "Costs", description: "Cost events and bulk ingestion." },
        { name: "Dimensions", description: "Locations, groups, parties, and products." },
        { name: "Analytics", description: "Derived metrics and dashboards." },
        { name: "Exports", description: "Bulk JSON/CSV export endpoints." },
        { name: "WebSocket", description: "Realtime WebSocket endpoint." },
      ],
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", persistAuthorization: true },
  });
});
