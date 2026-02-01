import { FastifyInstance } from "fastify";

export const computeDerivedMetrics = async (fastify: FastifyInstance) => {
  const weightMetrics = await fastify.prisma.$queryRaw<any[]>`
    WITH w AS (
      SELECT ae.uid,
             ae.event_at,
             we.weight_kg
      FROM animal_event ae
      JOIN weight_event we ON we.event_id = ae.event_id
    ), ranked AS (
      SELECT uid,
             weight_kg,
             event_at,
             row_number() OVER (PARTITION BY uid ORDER BY event_at DESC) AS rn
      FROM w
    ), agg AS (
      SELECT uid,
             MAX(CASE WHEN rn = 1 THEN weight_kg END) AS last_weight,
             MAX(CASE WHEN rn = 1 THEN event_at END) AS last_weight_at,
             MAX(CASE WHEN rn = 2 THEN weight_kg END) AS prev_weight,
             MAX(CASE WHEN rn = 2 THEN event_at END) AS prev_weight_at
      FROM ranked
      WHERE rn <= 2
      GROUP BY uid
    )
    SELECT uid,
           last_weight,
           last_weight_at,
           prev_weight,
           prev_weight_at,
           CASE
             WHEN prev_weight IS NOT NULL AND last_weight IS NOT NULL AND prev_weight_at IS NOT NULL THEN
               (last_weight - prev_weight) / GREATEST(EXTRACT(EPOCH FROM (last_weight_at - prev_weight_at)) / 86400, 1)
           END AS adg
    FROM agg;`;

  const locationRows = await fastify.prisma.$queryRaw<any[]>`
    WITH mv AS (
      SELECT uid,
             location_to_id,
             location_from_id,
             event_at,
             row_number() OVER (PARTITION BY uid ORDER BY event_at DESC, event_id DESC) AS rn
      FROM animal_event
      WHERE event_type = 'movement'
    )
    SELECT uid, COALESCE(location_to_id, location_from_id) AS last_location_id
    FROM mv
    WHERE rn = 1;`;

  const locationMap = new Map<string, bigint | null>();
  for (const row of locationRows) {
    locationMap.set(row.uid, row.last_location_id ? BigInt(row.last_location_id) : null);
  }

  await fastify.prisma.$transaction(async (tx) => {
    await tx.derivedMetric.deleteMany({ where: { kind: { in: ["animal_metrics", "summary"] } } });
    for (const row of weightMetrics) {
      const data: any = {
        adg: row.adg ? Number(row.adg) : null,
        last_weight: row.last_weight ? Number(row.last_weight) : null,
        last_weight_at: row.last_weight_at,
        prev_weight: row.prev_weight ? Number(row.prev_weight) : null,
        prev_weight_at: row.prev_weight_at,
        last_location_id: locationMap.get(row.uid) ?? null,
      };
      await tx.derivedMetric.create({ data: { kind: "animal_metrics", uid: row.uid, data } });
    }

    const monthly = await tx.$queryRaw<any[]>`
      WITH w AS (
        SELECT ae.uid,
               ae.event_at::date AS event_date,
               we.weight_kg
        FROM animal_event ae
        JOIN weight_event we ON we.event_id = ae.event_id
      ),
      lagged AS (
        SELECT uid,
               event_date,
               weight_kg,
               LAG(weight_kg) OVER (PARTITION BY uid ORDER BY event_date) AS prev_weight
        FROM w
      ),
      deltas AS (
        SELECT uid,
               event_date,
               CASE WHEN weight_kg > prev_weight AND prev_weight IS NOT NULL THEN weight_kg - prev_weight ELSE 0 END AS delta
        FROM lagged
      )
      SELECT date_trunc('month', event_date) AS month,
             SUM(delta) AS kilos
      FROM deltas
      GROUP BY 1
      ORDER BY 1 DESC;`;

    const avgAdg = weightMetrics
      .map((w) => (w.adg ? Number(w.adg) : 0))
      .filter((v) => v > 0);
    const summary = {
      avg_adg: avgAdg.length ? avgAdg.reduce((a, b) => a + b, 0) / avgAdg.length : 0,
      monthly_kilos: monthly.map((m) => ({ month: m.month, kilos: Number(m.kilos || 0) })),
      computed_at: new Date().toISOString(),
    };
    await tx.derivedMetric.create({ data: { kind: "summary", data: summary } });
  });

  const summaryRow = await fastify.prisma.derivedMetric.findFirst({ where: { kind: "summary" }, orderBy: { computed_at: "desc" } });
  if (summaryRow) {
    await fastify.redis.setex("metrics:summary", 300, JSON.stringify(summaryRow.data));
  }
};
