import { FastifyInstance } from "fastify";
import { bulkCostsSchema, costCreateSchema, exportCostsQuerySchema } from "@livestock/shared";
import { bulkCreateCosts, createCost, exportCosts, listCosts } from "../services/costs";
import { toCsv } from "../utils/csv";

export default async function costRoutes(fastify: FastifyInstance) {
  fastify.post("/costs", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = costCreateSchema.parse(request.body);
    const cost = await createCost(fastify, body, request.id);
    reply.code(201).send(cost);
  });

  fastify.post("/costs/bulk", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = bulkCostsSchema.parse(request.body);
    const created = await bulkCreateCosts(fastify, body.costs, request.id);
    reply.code(201).send({ costs: created });
  });

  fastify.get("/costs", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = (request.query as any) || {};
    const page = await listCosts(fastify, query);
    reply.send(page);
  });

  fastify.get(
    "/export/costs",
    {
      preHandler: fastify.authorize("viewer"),
      schema: {
        summary: "Export costs",
        description: "Returns JSON by default or CSV when format=csv. Pagination via limit/cursor.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            format: { type: "string", enum: ["json", "csv"] },
            limit: { type: "integer", minimum: 1, maximum: 5000 },
            cursor: { type: "string" },
            scope: { type: "string" },
            uid: { type: "string" },
            category: { type: "string" },
            batch_id: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Exported costs (JSON). For CSV, use format=csv.",
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object", additionalProperties: true } },
              nextCursor: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = exportCostsQuerySchema.partial().parse(request.query);
      const rows = await exportCosts(fastify, query);
      const format = (query.format || "json").toString().toLowerCase();
      const nextCursor = rows.length > 0 ? String(rows[rows.length - 1].cost_id) : undefined;

      if (format === "csv") {
        const columns = [
          "cost_id",
          "cost_at",
          "scope",
          "uid",
          "group_id",
          "location_id",
          "category",
          "product_id",
          "party_id",
          "amount",
          "currency",
          "quantity",
          "unit",
          "source_ref",
          "batch_id",
          "notes",
        ];
        const data = rows.map((r: any) => ({
          ...r,
          cost_at: r.cost_at ? r.cost_at.toISOString() : null,
        }));
        const csv = toCsv(data, columns);
        reply
          .header("content-type", "text/csv; charset=utf-8")
          .header("content-disposition", "attachment; filename=costs.csv")
          .header("x-next-cursor", nextCursor ?? "")
          .send(csv);
        return;
      }

      reply.send({ data: rows, nextCursor });
    }
  );
}
