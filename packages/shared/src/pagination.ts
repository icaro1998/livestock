import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./constants";

export type CursorPaginationParams = {
  cursor?: string | null;
  limit?: number | null;
};

export const parsePagination = (q: CursorPaginationParams) => {
  const limit = Math.min(Math.max(Number(q.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const cursor = q.cursor ? String(q.cursor) : undefined;
  return { limit, cursor };
};

export type CursorPage<T> = {
  data: T[];
  nextCursor?: string;
};

export const buildCursorPage = <T>(items: T[], limit: number, getCursor: (item: T) => string | number | bigint): CursorPage<T> => {
  if (items.length === 0) return { data: [] };
  const next = items.length === limit ? String(getCursor(items[items.length - 1])) : undefined;
  return { data: items, nextCursor: next };
};
