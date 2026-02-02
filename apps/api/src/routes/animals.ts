import { FastifyInstance } from "fastify";
import {
  animalCreateSchema,
  animalPatchSchema,
  animalsQuerySchema,
  exportAnimalsQuerySchema,
  WS_TOPICS,
} from "@livestock/shared";
import { ApiError } from "../utils/errors";
import { createAnimal, exportAnimals, getAnimalByUid, getAnimalTimeline, patchAnimal, searchAnimals } from "../services/animals";
import { toCsv } from "../utils/csv";

export default async function animalRoutes(fastify: FastifyInstance) {
  fastify.get("/animals", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = animalsQuerySchema.partial().parse(request.query);
    const page = await searchAnimals(fastify, query);
    reply.send(page);
  });

  fastify.get("/animals/:uid", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const uid = (request.params as any).uid as string;
    const animal = await getAnimalByUid(fastify, uid);
    reply.send(animal);
  });

  fastify.post("/animals", { preHandler: fastify.authorize("admin") }, async (request, reply) => {
    const body = animalCreateSchema.parse(request.body);
    const animal = await createAnimal(fastify, body);
    await fastify.publish(WS_TOPICS.animalUpdated, { uid: animal.uid }, request.id);
    reply.code(201).send(animal);
  });

  fastify.patch("/animals/:uid", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const uid = (request.params as any).uid as string;
    const expected = request.headers["if-match-version"];
    if (!expected) throw new ApiError(400, "If-Match-Version header required");
    const version = Number(expected);
    if (Number.isNaN(version)) throw new ApiError(400, "Invalid version header");
    const body = animalPatchSchema.parse(request.body);
    const updated = await patchAnimal(fastify, uid, body, version);
    await fastify.publish(WS_TOPICS.animalUpdated, { uid: updated.uid, version: updated.version }, request.id);
    reply.send(updated);
  });

  fastify.get("/animals/:uid/events", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const uid = (request.params as any).uid as string;
    const query = request.query as any;
    const page = await getAnimalTimeline(fastify, uid, query);
    reply.send(page);
  });

  fastify.get(
    "/export/animals",
    {
      preHandler: fastify.authorize("viewer"),
      schema: {
        summary: "Export animals",
        description: "Returns JSON by default or CSV when format=csv. Pagination via limit/cursor.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            format: { type: "string", enum: ["json", "csv"] },
            limit: { type: "integer", minimum: 1, maximum: 5000 },
            cursor: { type: "string" },
            search: { type: "string" },
            brand_mark: { type: "string" },
            alert: { type: "boolean" },
            min_age_months: { type: "integer" },
            max_age_months: { type: "integer" },
            min_weight: { type: "number" },
            max_weight: { type: "number" },
            last_event_type: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Exported animals (JSON). For CSV, use format=csv.",
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
      const query = exportAnimalsQuerySchema.partial().parse(request.query);
      const rows = await exportAnimals(fastify, query);
      const format = (query.format || "json").toString().toLowerCase();

    const nextCursor = rows.length > 0 ? rows[rows.length - 1].uid : undefined;

    if (format === "csv") {
      const columns = [
        "uid",
        "eid",
        "vid",
        "registration_at",
        "alert",
        "race",
        "sex",
        "color",
        "mother_name",
        "father_name",
        "brand_mark",
        "birth_year",
        "birth_month",
        "birth_place",
        "diagnostic",
        "warning",
        "notes",
        "created_at",
        "updated_at",
        "version",
      ];
      const data = rows.map((r: any) => ({
        ...r,
        registration_at: r.registration_at ? r.registration_at.toISOString() : null,
        created_at: r.created_at ? r.created_at.toISOString() : null,
        updated_at: r.updated_at ? r.updated_at.toISOString() : null,
      }));
      const csv = toCsv(data, columns);
      reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", "attachment; filename=animals.csv")
        .header("x-next-cursor", nextCursor ?? "")
        .send(csv);
      return;
    }

      reply.send({ data: rows, nextCursor });
    }
  );
}
