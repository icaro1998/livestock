import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { resolveGroup, resolveLocation, resolveParty, resolveProduct } from "./dimensions";
import { parsePagination, buildCursorPage, WS_TOPICS } from "@livestock/shared";
import { ApiError } from "../utils/errors";

const toDate = (v: any) => (v instanceof Date ? v : new Date(v));

const createCostInternal = async (fastify: FastifyInstance, input: any) => {
  const location = await resolveLocation(fastify.prisma, input.location_code);
  const group = await resolveGroup(fastify.prisma, input.group_code);
  const party = await resolveParty(fastify.prisma, input.party_code);
  const product = await resolveProduct(fastify.prisma, input.product_code);
  const cost = await fastify.prisma.costEvent.create({
    data: {
      cost_at: toDate(input.cost_at),
      scope: input.scope,
      uid: input.uid ?? null,
      group_id: group?.id,
      location_id: location?.id,
      category: input.category,
      product_id: product?.id,
      party_id: party?.id,
      amount: new Prisma.Decimal(input.amount),
      currency: input.currency || "BOB",
      quantity: input.quantity !== undefined ? new Prisma.Decimal(input.quantity) : null,
      unit: input.unit ?? null,
      source_ref: input.source_ref ?? null,
      batch_id: input.batch_id ?? null,
      notes: input.notes ?? null,
    },
  });
  return cost;
};

export const createCost = async (fastify: FastifyInstance, input: any, requestId?: string) => {
  const cost = await createCostInternal(fastify, input);
  await fastify.publish(WS_TOPICS.costCreated, cost, requestId);
  return cost;
};

export const bulkCreateCosts = async (fastify: FastifyInstance, costs: any[], requestId?: string) => {
  const created = await fastify.prisma.$transaction(async (tx) => {
    const results: any[] = [];
    for (const c of costs) {
      const location = await resolveLocation(tx, c.location_code);
      const group = await resolveGroup(tx, c.group_code);
      const party = await resolveParty(tx, c.party_code);
      const product = await resolveProduct(tx, c.product_code);
      const cost = await tx.costEvent.create({
        data: {
          cost_at: toDate(c.cost_at),
          scope: c.scope,
          uid: c.uid ?? null,
          group_id: group?.id,
          location_id: location?.id,
          category: c.category,
          product_id: product?.id,
          party_id: party?.id,
          amount: new Prisma.Decimal(c.amount),
          currency: c.currency || "BOB",
          quantity: c.quantity !== undefined ? new Prisma.Decimal(c.quantity) : null,
          unit: c.unit ?? null,
          source_ref: c.source_ref ?? null,
          batch_id: c.batch_id ?? null,
          notes: c.notes ?? null,
        },
      });
      results.push(cost);
    }
    return results;
  });
  for (const c of created) await fastify.publish(WS_TOPICS.costCreated, c, requestId);
  return created;
};

export const listCosts = async (fastify: FastifyInstance, query: any) => {
  const { limit, cursor } = parsePagination(query);
  const where: any = {};
  if (query.scope) where.scope = query.scope;
  if (query.uid) where.uid = query.uid;
  if (query.category) where.category = query.category;
  if (query.batch_id) where.batch_id = query.batch_id;
  if (query.from || query.to) {
    where.cost_at = {};
    if (query.from) where.cost_at.gte = toDate(query.from);
    if (query.to) where.cost_at.lte = toDate(query.to);
  }
  const costs = await fastify.prisma.costEvent.findMany({
    where,
    orderBy: { cost_id: "desc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { cost_id: BigInt(cursor) } : undefined,
  });
  return buildCursorPage(costs, limit, (c) => c.cost_id);
};

export const exportCosts = async (fastify: FastifyInstance, query: any) => {
  const limit = query.limit === undefined ? 1000 : Math.min(Number(query.limit), 5000);
  if (!Number.isFinite(limit) || limit <= 0) throw new ApiError(400, "Invalid limit");
  let cursor: bigint | undefined;
  if (query.cursor !== undefined && query.cursor !== null && query.cursor !== "") {
    try {
      cursor = BigInt(query.cursor);
    } catch {
      throw new ApiError(400, "Invalid cursor");
    }
  }
  const where: any = {};
  if (query.scope) where.scope = query.scope;
  if (query.uid) where.uid = query.uid;
  if (query.category) where.category = query.category;
  if (query.batch_id) where.batch_id = query.batch_id;
  if (query.from || query.to) {
    where.cost_at = {};
    if (query.from) where.cost_at.gte = toDate(query.from);
    if (query.to) where.cost_at.lte = toDate(query.to);
  }
  return fastify.prisma.costEvent.findMany({
    where,
    orderBy: { cost_id: "desc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { cost_id: cursor } : undefined,
  });
};
