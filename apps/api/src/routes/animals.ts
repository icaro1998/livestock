import { FastifyInstance } from "fastify";
import {
  animalCreateSchema,
  animalPatchSchema,
  animalsQuerySchema,
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

  fastify.get("/export/animals", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = request.query as any;
    const rows = await exportAnimals(fastify, query);
    const format = (query.format || "json").toString().toLowerCase();

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
        .send(csv);
      return;
    }

    reply.send(rows);
  });
}
