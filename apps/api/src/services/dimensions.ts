import { Prisma, PrismaClient, Location, HerdGroup, Party, Product } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const findOrCreate = async <T>(
  tx: DbClient,
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

export const resolveLocation = (tx: DbClient, code?: string | null) =>
  code ? findOrCreate<Location>(tx, "location", code) : Promise.resolve(undefined);

export const resolveGroup = (tx: DbClient, code?: string | null) =>
  code ? findOrCreate<HerdGroup>(tx, "herdGroup", code) : Promise.resolve(undefined);

export const resolveParty = (tx: DbClient, code?: string | null, type?: string | null) =>
  code ? findOrCreate<Party>(tx, "party", code, { type }) : Promise.resolve(undefined);

export const resolveProduct = (
  tx: DbClient,
  code?: string | null,
  category?: string | null,
  unit?: string | null
) =>
  code ? findOrCreate<Product>(tx, "product", code, { category, unit }) : Promise.resolve(undefined);

export const listDimension = async (tx: DbClient, table: "location" | "herdGroup" | "party" | "product") =>
  (tx as any)[table].findMany({ orderBy: { code: "asc" } });

export const createDimension = async (
  tx: DbClient,
  table: "location" | "herdGroup" | "party" | "product",
  data: {
    code: string;
    name?: string | null;
    type?: string | null;
    category?: string | null;
    unit?: string | null;
    meta?: any;
  }
) => {
  const payload: Record<string, unknown> = { code: data.code };
  if (data.name !== undefined) payload.name = data.name;
  if (data.meta !== undefined) payload.meta = data.meta;
  if ((table === "location" || table === "party") && data.type !== undefined) payload.type = data.type;
  if (table === "product") {
    if (data.category !== undefined) payload.category = data.category;
    if (data.unit !== undefined) payload.unit = data.unit;
  }
  return (tx as any)[table].create({ data: payload });
};
