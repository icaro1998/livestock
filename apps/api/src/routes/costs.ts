import { FastifyInstance } from "fastify";
import { bulkCostsSchema, costCreateSchema, exportCostsQuerySchema } from "@livestock/shared";
import { bulkCreateCosts, createCost, exportCosts, listCosts } from "../services/costs";
import { toCsv } from "../utils/csv";

const cursorPageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { type: "array", items: { type: "object", additionalProperties: true } },
    nextCursor: { type: ["string", "null"] },
  },
};

export default async function costRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/costs",
    {
      preHandler: fastify.authorize("manager"),
      schema: {
        tags: ["Costs"],
        summary: "Create cost",
        body: {
          type: "object",
          additionalProperties: true,
          required: ["cost_at", "scope", "category", "amount"],
          properties: {
            cost_at: { type: "string" },
            scope: { type: "string" },
            uid: { type: "string" },
            group_code: { type: "string" },
            location_code: { type: "string" },
            category: { type: "string" },
            product_code: { type: "string" },
            party_code: { type: "string" },
            amount: { type: "number" },
            currency: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            source_ref: { type: "string" },
            batch_id: { type: "string" },
            notes: { type: "string" },
            payload: { type: "object", additionalProperties: true },
          },
        },
        response: {
          201: { type: "object", additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      const body = costCreateSchema.parse(request.body);
      const cost = await createCost(fastify, body, request.id);
      reply.code(201).send(cost);
    }
  );

  fastify.post(
    "/costs/bulk",
    {
      preHandler: fastify.authorize("manager"),
      schema: {
        tags: ["Costs"],
        summary: "Bulk create costs",
        body: {
          type: "object",
          additionalProperties: true,
          required: ["costs"],
          properties: {
            costs: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
        response: {
          201: {
            type: "object",
            additionalProperties: false,
            properties: { costs: { type: "array", items: { type: "object", additionalProperties: true } } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = bulkCostsSchema.parse(request.body);
      const created = await bulkCreateCosts(fastify, body.costs, request.id);
      reply.code(201).send({ costs: created });
    }
  );

  fastify.get(
    "/costs",
    {
      preHandler: fastify.authorize("viewer"),
      schema: {
        tags: ["Costs"],
        summary: "List costs",
        querystring: {
          type: "object",
          additionalProperties: true,
          properties: {
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
        response: { 200: cursorPageSchema },
      },
    },
    async (request, reply) => {
      const query = (request.query as any) || {};
      const page = await listCosts(fastify, query);
      reply.send(page);
    }
  );

  fastify.get(
    "/export/costs",
    {
      preHandler: fastify.authorize("viewer"),
      schema: {
        tags: ["Exports", "Costs"],
        summary: "Export costs",
        description: "Returns JSON by default or CSV when format=csv. Pagination via limit/cursor.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: true,
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
