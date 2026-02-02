# Observability: Logs, Metrics, Alerts

This backend already exposes health and metrics endpoints and uses structured logging. This document describes the current state and the minimal production setup.

## 1) Logging
- Fastify uses structured JSON logging (pino).
- Request IDs are attached to responses (see `apps/api/src/plugins/request-id.ts`).
- Logs are written to stdout; container runtime should capture and forward them.

Additional fields on response logs:
- `route`, `method`, `statusCode`, `responseTimeMs`
- `userId`, `role`, `email` when authenticated

Recommended:
- Centralize logs (e.g., Loki/ELK/Cloud logs).
- Index `reqId`, `statusCode`, `route`, `userId` where applicable.

## 2) Metrics
- Metrics endpoint: `GET /metrics`.
- Health endpoint: `GET /healthz`.
- Readiness endpoint: `GET /readyz`.

`/metrics` returns:
- `uptime_sec`, `rss`, `heapUsed`, `heapTotal`
- `pid`, `node_version`, `timestamp`
- `db_ok`, `redis_ok` (connectivity checks)

Recommended:
- Configure Prometheus to scrape `/metrics`.
- Add Grafana dashboards for:
  - request rate, latency, error rates
  - DB errors/timeouts
  - Redis connectivity

## 3) Alerts (minimal)
- High error rate (5xx) threshold
- API unavailable (healthz fails)
- DB unreachable
- Redis unreachable
 - db_ok/redis_ok are false for > N minutes

Quick local checks:
```powershell
.\scripts\health-check.ps1
```

```bash
./scripts/health-check.sh
```

## 4) Suggested monitoring stack
- Prometheus (metrics scrape)
- Grafana (dashboards + alerts)
- Loki or ELK (log aggregation)

## 5) Future improvements
- Add tracing (OpenTelemetry) for cross-service traces
- Add per-route latency metrics
- Add business metrics (events ingested/hour, animals created/day)
