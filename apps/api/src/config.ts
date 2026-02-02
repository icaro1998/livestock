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

const repoRoot = path.resolve(__dirname, "../../../");
const resolveRepoPath = (value: string | undefined, fallback: string) => {
  if (!value) return path.join(repoRoot, fallback);
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
};

const env = process.env.NODE_ENV || "development";
const isProduction = env === "production";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) return null;
  return value;
};

if (isProduction) {
  const errors: string[] = [];
  const required = ["DATABASE_URL", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGIN"];
  for (const key of required) {
    if (!requireEnv(key)) {
      errors.push(`Missing ${key}`);
    }
  }

  if (process.env.CORS_ORIGIN === "*") {
    errors.push("CORS_ORIGIN must be an explicit origin in production");
  }

  if (bool(process.env.BOOTSTRAP_ADMIN, false)) {
    errors.push("BOOTSTRAP_ADMIN must be false in production");
  }
  if (bool(process.env.OPENAPI_ENABLED, false)) {
    errors.push("OPENAPI_ENABLED must be false in production");
  }
  if (bool(process.env.AUTO_MIGRATE, false)) {
    errors.push("AUTO_MIGRATE must be false in production");
  }
  if (bool(process.env.AUTO_SEED, false)) {
    errors.push("AUTO_SEED must be false in production");
  }

  if (errors.length) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
}

export const config = {
  env,
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
  dbUrl: isProduction
    ? (requireEnv("DATABASE_URL") as string)
    : process.env.DATABASE_URL || "postgresql://livestock:livestock@localhost:5432/livestock",
  redisUrl: isProduction ? (requireEnv("REDIS_URL") as string) : process.env.REDIS_URL || "redis://localhost:6379",
  jwtAccessSecret: isProduction
    ? (requireEnv("JWT_ACCESS_SECRET") as string)
    : process.env.JWT_ACCESS_SECRET || "devaccesssecret",
  jwtRefreshSecret: isProduction
    ? (requireEnv("JWT_REFRESH_SECRET") as string)
    : process.env.JWT_REFRESH_SECRET || "devrefreshsecret",
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  bootstrapAdmin: bool(process.env.BOOTSTRAP_ADMIN, !isProduction),
  openapiEnabled: bool(process.env.OPENAPI_ENABLED, !isProduction),
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  animalsCsvPath: resolveRepoPath(process.env.ANIMALS_CSV_PATH, "data/ANIMAL_REG - data.csv"),
};
