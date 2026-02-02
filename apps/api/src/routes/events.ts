import { FastifyInstance } from "fastify";
import { eventCreateSchema, bulkEventsSchema, eventsQuerySchema, exportEventsQuerySchema, IDEMPOTENCY_KEY_HEADER } from "@livestock/shared";
import { createEvent, bulkCreateEvents, exportEvents, listEvents } from "../services/events";
import { safeJsonStringify, toCsv } from "../utils/csv";

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

  fastify.get("/export/events", { preHandler: fastify.authorize("viewer") }, async (request, reply) => {
    const query = exportEventsQuerySchema.partial().parse(request.query);
    const rows = await exportEvents(fastify, query);
    const format = (query.format || "json").toString().toLowerCase();
    const includePayload = query.include_payload === "true" || query.include_payload === true;
    const nextCursor = rows.length > 0 ? String(rows[rows.length - 1].event_id) : undefined;

    if (format === "csv") {
      const columns = [
        "event_id",
        "uid",
        "event_at",
        "event_type",
        "event_subtype",
        "source_ref",
        "batch_id",
        "confidence",
        "notes",
        "location_from_id",
        "location_to_id",
        "group_id",
        "party_id",
        "product_id",
        "created_at",
      ];
      if (includePayload) columns.push("payload");
      const data = rows.map((r: any) => ({
        ...r,
        event_at: r.event_at ? r.event_at.toISOString() : null,
        created_at: r.created_at ? r.created_at.toISOString() : null,
        payload: includePayload ? safeJsonStringify(r.payload ?? null) : undefined,
      }));
      const csv = toCsv(data, columns);
      reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", "attachment; filename=events.csv")
        .header("x-next-cursor", nextCursor ?? "")
        .send(csv);
      return;
    }

    reply.send({ data: rows, nextCursor });
  });
}
