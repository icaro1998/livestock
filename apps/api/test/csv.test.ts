import { describe, it, expect } from "vitest";
import { escapeCsv, toCsv, safeJsonStringify } from "../src/utils/csv";

describe("csv utils", () => {
  it("escapes commas and quotes", () => {
    expect(escapeCsv("plain")).toBe("plain");
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('a"b')).toBe('"a""b"');
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
  });

  it("builds a CSV with headers", () => {
    const rows = [
      { id: 1, name: "alpha" },
      { id: 2, name: "bravo" },
    ];
    const csv = toCsv(rows, ["id", "name"]);
    expect(csv.split("\n")[0]).toBe("id,name");
    expect(csv).toContain("1,alpha");
    expect(csv).toContain("2,bravo");
  });

  it("stringifies bigint safely", () => {
    const json = safeJsonStringify({ id: 1n });
    expect(json).toBe('{"id":"1"}');
  });
});
