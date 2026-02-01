import { FastifyInstance } from "fastify";
import { eventCreateSchema, bulkEventsSchema, eventsQuerySchema, IDEMPOTENCY_KEY_HEADER } from "@livestock/shared";
import { createEvent, bulkCreateEvents, listEvents } from "../services/events";

export default async function eventRoutes(fastify: FastifyInstance) {
  fastify.post("/events", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = eventCreateSchema.parse(request.body);
    const idem = request.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;
    const { event, dedup } = await createEvent(
      fastify,
      { ...body, source_ref: idem ?? body.source_ref },
      request.id
    );
    reply.code(dedup ? 200 : 201).send(event);
  });

  fastify.post("/events/bulk", { preHandler: fastify.authorize("manager") }, async (request, reply) => {
    const body = bulkEventsSchema.parse(request.body);
    const idem = request.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;
    const events = body.events.map((e) => ({ ...e, source_ref: idem ?? e.source_ref }));
    const result = await bulkCreateEvents(fastify, events, request.id);
    const dedup = result.every((r) => r.dedup);
    reply.code(dedup ? 200 : 201).send({ events: result.map((r) => r.event) });
  });

  fastify.get("/events", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = eventsQuerySchema.partial().parse(request.query);
    const page = await listEvents(fastify, query);
    reply.send(page);
  });
}
