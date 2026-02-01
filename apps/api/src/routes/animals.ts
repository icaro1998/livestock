import { FastifyInstance } from "fastify";
import {
  animalCreateSchema,
  animalPatchSchema,
  animalsQuerySchema,
  WS_TOPICS,
} from "@livestock/shared";
import { ApiError } from "../utils/errors";
import { createAnimal, getAnimalByUid, getAnimalTimeline, patchAnimal, searchAnimals } from "../services/animals";

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
}
