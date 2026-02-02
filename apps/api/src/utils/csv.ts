export const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

export const toCsv = (rows: Record<string, unknown>[], columns: string[]) => {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsv(row[c])).join(","));
  return [header, ...lines].join("\n");
};

export const safeJsonStringify = (value: unknown) =>
  JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
