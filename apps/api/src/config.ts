import dotenv from "dotenv";
import path from "path";

dotenv.config();
// If running from apps/api, load repo-root .env as a fallback.
if (!process.env.DATABASE_URL) {
  const rootEnv = path.resolve(__dirname, "../../../.env");
  dotenv.config({ path: rootEnv });
}

const bool = (val: string | undefined, def = false) => {
  if (val === undefined) return def;
  return ["1", "true", "yes", "on"].includes(val.toLowerCase());
};

export const config = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
  dbUrl: process.env.DATABASE_URL || "postgresql://livestock:livestock@localhost:5432/livestock",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "devaccesssecret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "devrefreshsecret",
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  bootstrapAdmin: bool(process.env.BOOTSTRAP_ADMIN, true),
  openapiEnabled: bool(process.env.OPENAPI_ENABLED, true),
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  animalsCsvPath:
    process.env.ANIMALS_CSV_PATH || path.resolve(__dirname, "../../../data/ANIMAL_REG - data.csv"),
};
