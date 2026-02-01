import { PrismaClient, Location, HerdGroup, Party, Product } from "@prisma/client";

const findOrCreate = async <T>(
  tx: PrismaClient,
  table: "location" | "herdGroup" | "party" | "product",
  code: string,
  extra: Record<string, any> = {}
): Promise<T> => {
  if (!code) throw new Error("code required");
  // code must be stored exactly as provided
  const existing = await (tx as any)[table].findUnique({ where: { code } });
  if (existing) return existing as T;
  const created = await (tx as any)[table].create({ data: { code, ...extra } });
  return created as T;
};

export const resolveLocation = (tx: PrismaClient, code?: string | null) =>
  code ? findOrCreate<Location>(tx, "location", code) : Promise.resolve(undefined);

export const resolveGroup = (tx: PrismaClient, code?: string | null) =>
  code ? findOrCreate<HerdGroup>(tx, "herdGroup", code) : Promise.resolve(undefined);

export const resolveParty = (tx: PrismaClient, code?: string | null, type?: string | null) =>
  code ? findOrCreate<Party>(tx, "party", code, { type }) : Promise.resolve(undefined);

export const resolveProduct = (tx: PrismaClient, code?: string | null, category?: string | null, unit?: string | null) =>
  code ? findOrCreate<Product>(tx, "product", code, { category, unit }) : Promise.resolve(undefined);

export const listDimension = async (tx: PrismaClient, table: "location" | "herdGroup" | "party" | "product") =>
  (tx as any)[table].findMany({ orderBy: { code: "asc" } });

export const createDimension = async (
  tx: PrismaClient,
  table: "location" | "herdGroup" | "party" | "product",
  data: { code: string; name?: string | null; type?: string | null; meta?: any }
) => (tx as any)[table].create({ data });
