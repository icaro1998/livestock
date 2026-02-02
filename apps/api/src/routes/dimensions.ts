import { FastifyInstance } from "fastify";
import { dimensionCreateSchema, exportDimensionsQuerySchema, WS_TOPICS } from "@livestock/shared";
import { createDimension, listDimension } from "../services/dimensions";
import { toCsv } from "../utils/csv";

const register = (
  fastify: FastifyInstance,
  path: string,
  table: "location" | "herdGroup" | "party" | "product"
) => {
  fastify.get(path, { preHandler: fastify.authorize("viewer") }, async (_, reply) => {
    const rows = await listDimension(fastify.prisma, table);
    reply.send(rows);
  });

  fastify.post(path, { preHandler: fastify.authorize("admin") }, async (request, reply) => {
    const body = dimensionCreateSchema.parse(request.body);
    const created = await createDimension(fastify.prisma, table, body);
    await fastify.publish(WS_TOPICS.dimensionUpdated, { table, code: created.code }, request.id);
    reply.code(201).send(created);
  });
};

export default async function dimensionRoutes(fastify: FastifyInstance) {
  register(fastify, "/locations", "location");
  register(fastify, "/groups", "herdGroup");
  register(fastify, "/parties", "party");
  register(fastify, "/products", "product");

  fastify.get(
    "/export/dimensions",
    {
      preHandler: fastify.authorize("viewer"),
      schema: {
        summary: "Export dimensions",
        description: "Returns JSON by default or CSV when format=csv. Optional table filter.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            format: { type: "string", enum: ["json", "csv"] },
            table: { type: "string", enum: ["location", "herdGroup", "party", "product"] },
          },
        },
        response: {
          200: {
            description: "Exported dimensions (JSON). For CSV, use format=csv.",
            type: "object",
            properties: {
              data: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = exportDimensionsQuerySchema.partial().parse(request.query);
      const format = (query.format || "json").toString().toLowerCase();
      const tableFilter = query.table;

      const tables: Array<{ name: "location" | "herdGroup" | "party" | "product"; data: any[] }> = [];
      const addTable = async (name: "location" | "herdGroup" | "party" | "product") => {
        const rows = await listDimension(fastify.prisma, name);
        tables.push({ name, data: rows });
      };

      if (tableFilter) {
        await addTable(tableFilter);
      } else {
        await addTable("location");
        await addTable("herdGroup");
        await addTable("party");
        await addTable("product");
      }

      if (format === "csv") {
        const rows = tables.flatMap((t) =>
          t.data.map((r: any) => ({
            table: t.name,
            id: r.id,
            code: r.code,
            name: r.name ?? null,
            type: r.type ?? null,
            meta: r.meta ?? null,
          }))
        );
        const csv = toCsv(rows, ["table", "id", "code", "name", "type", "meta"]);
        reply
          .header("content-type", "text/csv; charset=utf-8")
          .header("content-disposition", "attachment; filename=dimensions.csv")
          .send(csv);
        return;
      }

      reply.send({ data: tables });
    }
  );
}
