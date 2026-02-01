import { describe, expect, it } from "vitest";
import { parsePagination } from "../src/pagination";

describe("parsePagination", () => {
  it("caps max page size", () => {
    const { limit } = parsePagination({ limit: 999 });
    expect(limit).toBeLessThanOrEqual(200);
  });

  it("defaults when missing", () => {
    const { limit, cursor } = parsePagination({});
    expect(limit).toBeGreaterThan(0);
    expect(cursor).toBeUndefined();
  });
});
