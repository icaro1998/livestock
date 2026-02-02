import { FastifyInstance } from "fastify";
import { Prisma, PrismaClient } from "@prisma/client";
import { resolveGroup, resolveLocation, resolveParty, resolveProduct } from "./dimensions";
import { ApiError } from "../utils/errors";
import { WS_TOPICS, parsePagination, buildCursorPage } from "@livestock/shared";

const toDate = (val: any) => (val instanceof Date ? val : new Date(val));

const attachPayload = (input: any) => {
  const payload: any = { ...(input.payload || {}) };
  if (input.event_type === "weight") {
    if (input.weight_kg !== undefined) payload.weight_kg = input.weight_kg;
    if (input.method !== undefined) payload.method = input.method;
    if (input.shrink_pct !== undefined) payload.shrink_pct = input.shrink_pct;
  }
  if (input.event_type === "movement") {
    payload.origin = input.location_from_code;
    payload.destiny = input.location_to_code;
    if (input.reason) payload.reason = input.reason;
  }
  if (input.event_type === "repro") {
    payload.repro_action = input.repro_action;
    payload.sire_uid = input.sire_uid;
    payload.dam_uid = input.dam_uid;
    payload.result = input.result;
    payload.calf_uid = input.calf_uid;
    payload.gestation_days = input.gestation_days;
  }
  if (input.event_type === "health") {
    payload.action = input.action;
    payload.diagnosis = input.diagnosis;
    payload.dose = input.dose;
    payload.dose_unit = input.dose_unit;
    payload.withdrawal_days = input.withdrawal_days;
  }
  if (input.event_type === "nutrition") {
    payload.ration_code = input.ration_code;
    payload.intake_kg_day = input.intake_kg_day;
    payload.supplement_code = input.supplement_code;
    payload.reason = input.reason;
  }
  return payload;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

const findExistingByDedup = async (tx: DbClient, input: any) => {
  const rows = await tx.$queryRawUnsafe<any[]>(
    `SELECT event_id FROM animal_event WHERE uid = $1 AND event_at = $2 AND event_type = $3 AND COALESCE(event_subtype,'') = $4 AND COALESCE(source_ref,'') = $5 LIMIT 1`,
    input.uid,
    toDate(input.event_at),
    input.event_type,
    input.event_subtype ?? "",
    input.source_ref ?? ""
  );
  if (rows.length === 0) return null;
  return tx.animalEvent.findUnique({
    where: { event_id: rows[0].event_id },
    include: { weight: true, movement: true, repro: true, health: true, nutrition: true },
  });
};

const createAnimalIfMissing = async (tx: PrismaClient, uid: string) => {
  await tx.animal.upsert({ where: { uid }, update: {}, create: { uid } });
};

const createStrongArm = async (tx: PrismaClient, eventId: bigint, input: any) => {
  switch (input.event_type) {
    case "weight":
      await tx.weightEvent.create({
        data: {
          event_id: eventId,
          weight_kg: input.weight_kg !== undefined ? new Prisma.Decimal(input.weight_kg) : null,
          method: input.method ?? null,
          shrink_pct: input.shrink_pct !== undefined ? new Prisma.Decimal(input.shrink_pct) : null,
        },
      });
      break;
    case "movement": {
      let transportPartyId: bigint | undefined;
      if (input.transport_party_code) {
        const party = await resolveParty(tx, input.transport_party_code, null);
        transportPartyId = party?.id;
      }
      await tx.movementEvent.create({
        data: {
          event_id: eventId,
          reason: input.reason ?? null,
          distance_km: input.distance_km !== undefined ? new Prisma.Decimal(input.distance_km) : null,
          transport_party_id: transportPartyId,
        },
      });
      break;
    }
    case "repro":
      await tx.reproEvent.create({
        data: {
          event_id: eventId,
          repro_action: input.repro_action ?? null,
          sire_uid: input.sire_uid ?? null,
          dam_uid: input.dam_uid ?? null,
          result: input.result ?? null,
          calf_uid: input.calf_uid ?? null,
          gestation_days: input.gestation_days ?? null,
        },
      });
      break;
    case "health":
      await tx.healthEvent.create({
        data: {
          event_id: eventId,
          action: input.action ?? null,
          diagnosis: input.diagnosis ?? null,
          dose: input.dose !== undefined ? new Prisma.Decimal(input.dose) : null,
          dose_unit: input.dose_unit ?? null,
          withdrawal_days: input.withdrawal_days ?? null,
        },
      });
      break;
    case "nutrition":
      await tx.nutritionEvent.create({
        data: {
          event_id: eventId,
          ration_code: input.ration_code ?? null,
          intake_kg_day: input.intake_kg_day !== undefined ? new Prisma.Decimal(input.intake_kg_day) : null,
          supplement_code: input.supplement_code ?? null,
          reason: input.reason ?? null,
        },
      });
      break;
    default:
      break;
  }
};

const createEventInternal = async (tx: DbClient, input: any) => {
  const payload = attachPayload(input);
  await createAnimalIfMissing(tx, input.uid);
  if (input.event_type === "movement") {
    if (!input.location_from_code || !input.location_to_code) {
      throw new ApiError(400, "Movement events require location_from_code and location_to_code");
    }
  }
  const location_from = await resolveLocation(tx, input.location_from_code);
  const location_to = await resolveLocation(tx, input.location_to_code);
  const group = await resolveGroup(tx, input.group_code);
  const party = await resolveParty(tx, input.party_code);
  const product = await resolveProduct(tx, input.product_code);

  const event = await tx.animalEvent.create({
    data: {
      uid: input.uid,
      event_at: toDate(input.event_at),
      event_type: input.event_type,
      event_subtype: input.event_subtype ?? null,
      source_ref: input.source_ref ?? null,
      batch_id: input.batch_id ?? null,
      confidence: input.confidence !== undefined ? new Prisma.Decimal(input.confidence) : null,
      notes: input.notes ?? null,
      location_from_id: location_from?.id,
      location_to_id: location_to?.id,
      group_id: group?.id,
      party_id: party?.id,
      product_id: product?.id,
      payload,
    },
  });
  await createStrongArm(tx, event.event_id, input);
  return tx.animalEvent.findUnique({
    where: { event_id: event.event_id },
    include: { weight: true, movement: true, repro: true, health: true, nutrition: true },
  });
};

export const createEvent = async (fastify: FastifyInstance, input: any, requestId?: string) => {
  try {
    const result = await fastify.prisma.$transaction((tx) => createEventInternal(tx, input));
    await fastify.publish(WS_TOPICS.eventCreated, result, requestId);
    return { event: result, dedup: false };
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await findExistingByDedup(fastify.prisma, input);
      if (existing) return { event: existing, dedup: true };
    }
    throw err;
  }
};

export const bulkCreateEvents = async (fastify: FastifyInstance, events: any[], requestId?: string) => {
  const created = await fastify.prisma.$transaction(async (tx) => {
    const results: { event: any; dedup: boolean }[] = [];
    for (const ev of events) {
      try {
        const res = await createEventInternal(tx, ev);
        results.push({ event: res, dedup: false });
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const existing = await findExistingByDedup(tx, ev);
          if (existing) {
            results.push({ event: existing, dedup: true });
            continue;
          }
        }
        throw err;
      }
    }
    return results;
  });
  for (const e of created) await fastify.publish(WS_TOPICS.eventCreated, e.event, requestId);
  return created;
};

export const listEvents = async (fastify: FastifyInstance, query: any) => {
  const { limit, cursor } = parsePagination(query);
  const where: any = {};
  if (query.uid) where.uid = query.uid;
  if (query.event_type) where.event_type = query.event_type;
  if (query.batch_id) where.batch_id = query.batch_id;
  if (query.from || query.to) {
    where.event_at = {};
    if (query.from) where.event_at.gte = toDate(query.from);
    if (query.to) where.event_at.lte = toDate(query.to);
  }
  if (query.location_code) {
    const loc = await fastify.prisma.location.findUnique({ where: { code: query.location_code } });
    if (loc) where.OR = [{ location_from_id: loc.id }, { location_to_id: loc.id }];
    else where.event_id = -1; // force empty
  }
  if (query.group_code) {
    const group = await fastify.prisma.herdGroup.findUnique({ where: { code: query.group_code } });
    where.group_id = group?.id ?? 0;
  }
  const events = await fastify.prisma.animalEvent.findMany({
    where,
    orderBy: { event_id: "desc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { event_id: BigInt(cursor) } : undefined,
    include: { weight: true, movement: true, repro: true, health: true, nutrition: true },
  });
  return buildCursorPage(events, limit, (e) => e.event_id);
};
