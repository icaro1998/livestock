import { FastifyInstance } from "fastify";
import { parsePagination, buildCursorPage } from "@livestock/shared";
import { ApiError } from "../utils/errors";

export const createAnimal = async (fastify: FastifyInstance, data: any) => {
  return fastify.prisma.animal.create({ data });
};

export const patchAnimal = async (
  fastify: FastifyInstance,
  uid: string,
  data: any,
  expectedVersion: number
) => {
  return fastify.prisma.$transaction(async (tx) => {
    const current = await tx.animal.findUnique({ where: { uid } });
    if (!current) throw new ApiError(404, "Animal not found");
    if (current.version !== expectedVersion) {
      throw new ApiError(409, "Version mismatch", { currentVersion: current.version });
    }
    const updated = await tx.animal.update({
      where: { uid },
      data: { ...data, version: { increment: 1 }, updated_at: new Date() },
    });
    return updated;
  });
};

export const getAnimalByUid = async (fastify: FastifyInstance, uid: string) => {
  const animal = await fastify.prisma.animal.findUnique({ where: { uid } });
  if (!animal) throw new ApiError(404, "Animal not found");
  return animal;
};

export const getAnimalTimeline = async (
  fastify: FastifyInstance,
  uid: string,
  params: { limit?: number; cursor?: string }
) => {
  const { limit, cursor } = parsePagination(params);
  const events = await fastify.prisma.animalEvent.findMany({
    where: { uid },
    include: {
      weight: true,
      movement: true,
      repro: true,
      health: true,
      nutrition: true,
    },
    orderBy: { event_id: "desc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { event_id: BigInt(cursor) } : undefined,
  });
  return buildCursorPage(events, limit, (e) => e.event_id);
};

export const searchAnimals = async (fastify: FastifyInstance, params: any) => {
  const { limit, cursor } = parsePagination(params);
  const where: any = {};
  const and: any[] = [];
  if (params.search) {
    const search = params.search;
    where.OR = [
      { uid: { contains: search } },
      { eid: { contains: search } },
      { brand_mark: { contains: search } },
      { mother_name: { contains: search } },
      { father_name: { contains: search } },
    ];
  }
  if (params.brand_mark) where.brand_mark = params.brand_mark;
  if (params.alert !== undefined) where.alert = params.alert;

  if (params.min_age_months || params.max_age_months) {
    const now = new Date();
    const minAge = params.min_age_months ? Number(params.min_age_months) : undefined;
    const maxAge = params.max_age_months ? Number(params.max_age_months) : undefined;
    if (minAge !== undefined) {
      const threshold = new Date(now);
      threshold.setMonth(threshold.getMonth() - minAge);
      const y = threshold.getFullYear();
      const m = threshold.getMonth() + 1;
      and.push({ OR: [{ birth_year: { lt: y } }, { birth_year: y, birth_month: { lte: m } }] });
    }
    if (maxAge !== undefined) {
      const threshold = new Date(now);
      threshold.setMonth(threshold.getMonth() - maxAge);
      const y = threshold.getFullYear();
      const m = threshold.getMonth() + 1;
      and.push({ OR: [{ birth_year: { gt: y } }, { birth_year: y, birth_month: { gte: m } }] });
    }
  }

  // approximate filters using relations
  if (params.last_event_type) {
    where.events = { some: { event_type: params.last_event_type } };
  }

  if (and.length) where.AND = and;

  if (params.min_weight || params.max_weight) {
    const min = params.min_weight ? Number(params.min_weight) : undefined;
    const max = params.max_weight ? Number(params.max_weight) : undefined;
    const rows: any[] = await fastify.prisma.$queryRaw`
      WITH ranked AS (
        SELECT ae.uid, we.weight_kg,
               row_number() OVER (PARTITION BY ae.uid ORDER BY ae.event_at DESC, ae.event_id DESC) AS rn
        FROM animal_event ae
        JOIN weight_event we ON we.event_id = ae.event_id
      )
      SELECT uid, weight_kg FROM ranked WHERE rn = 1
    `;
    const uids = rows
      .filter((r) => {
        const w = Number(r.weight_kg || 0);
        if (min !== undefined && w < min) return false;
        if (max !== undefined && w > max) return false;
        return true;
      })
      .map((r) => r.uid);
    if (uids.length === 0) return { data: [], nextCursor: undefined };
    where.uid = { in: uids };
  }

  const animals = await fastify.prisma.animal.findMany({
    where,
    orderBy: { uid: "asc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { uid: cursor } : undefined,
  });
  return buildCursorPage(animals, limit, (a) => a.uid);
};

export const exportAnimals = async (fastify: FastifyInstance, params: any) => {
  const where: any = {};
  const limit = params.limit === undefined ? 1000 : Math.min(Number(params.limit), 5000);
  if (!Number.isFinite(limit) || limit <= 0) throw new ApiError(400, "Invalid limit");
  const cursor = params.cursor ? params.cursor.toString() : undefined;
  if (params.search) {
    const search = params.search;
    where.OR = [
      { uid: { contains: search } },
      { eid: { contains: search } },
      { brand_mark: { contains: search } },
      { mother_name: { contains: search } },
      { father_name: { contains: search } },
    ];
  }
  if (params.brand_mark) where.brand_mark = params.brand_mark;
  if (params.alert !== undefined) where.alert = params.alert === true || params.alert === "true";

  if (params.min_age_months || params.max_age_months) {
    const now = new Date();
    const minAge = params.min_age_months ? Number(params.min_age_months) : undefined;
    const maxAge = params.max_age_months ? Number(params.max_age_months) : undefined;
    const and: any[] = [];
    if (minAge !== undefined) {
      const threshold = new Date(now);
      threshold.setMonth(threshold.getMonth() - minAge);
      const y = threshold.getFullYear();
      const m = threshold.getMonth() + 1;
      and.push({ OR: [{ birth_year: { lt: y } }, { birth_year: y, birth_month: { lte: m } }] });
    }
    if (maxAge !== undefined) {
      const threshold = new Date(now);
      threshold.setMonth(threshold.getMonth() - maxAge);
      const y = threshold.getFullYear();
      const m = threshold.getMonth() + 1;
      and.push({ OR: [{ birth_year: { gt: y } }, { birth_year: y, birth_month: { gte: m } }] });
    }
    if (and.length) where.AND = and;
  }

  if (params.last_event_type) {
    where.events = { some: { event_type: params.last_event_type } };
  }

  if (params.min_weight || params.max_weight) {
    const min = params.min_weight ? Number(params.min_weight) : undefined;
    const max = params.max_weight ? Number(params.max_weight) : undefined;
    const rows: any[] = await fastify.prisma.$queryRaw`
      WITH ranked AS (
        SELECT ae.uid, we.weight_kg,
               row_number() OVER (PARTITION BY ae.uid ORDER BY ae.event_at DESC, ae.event_id DESC) AS rn
        FROM animal_event ae
        JOIN weight_event we ON we.event_id = ae.event_id
      )
      SELECT uid, weight_kg FROM ranked WHERE rn = 1
    `;
    const uids = rows
      .filter((r) => {
        const w = Number(r.weight_kg || 0);
        if (min !== undefined && w < min) return false;
        if (max !== undefined && w > max) return false;
        return true;
      })
      .map((r) => r.uid);
    if (uids.length === 0) return [];
    where.uid = { in: uids };
  }

  return fastify.prisma.animal.findMany({
    where,
    orderBy: { uid: "asc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { uid: cursor } : undefined,
  });
};
