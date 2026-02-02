import dotenv from "dotenv";

dotenv.config();

const bool = (val: string | undefined, def = false) => {
  if (val === undefined) return def;
  return ["1", "true", "yes", "on"].includes(val.toLowerCase());
};

const isDisallowedSecret = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  const disallowed = new Set([
    "changeme",
    "change-me",
    "change_me",
    "secret",
    "password",
    "admin",
    "default",
    "devaccesssecret",
    "devrefreshsecret",
    "devsecret",
  ]);
  return disallowed.has(normalized);
};

type Config = {
  env: string;
  host: string;
  port: number;
  dbUrl: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpires: string;
  jwtRefreshExpires: string;
  bootstrapAdmin: boolean;
  openapiEnabled: boolean;
  rateLimit: {
    max: number;
    timeWindow: string;
  };
  corsOrigin: string;
  animalsCsvPath: string;
};

const assertProductionSafety = (cfg: Config) => {
  if (cfg.env !== "production") return;

  const minSecretLength = 32;
  const errors: string[] = [];

  if (cfg.jwtAccessSecret.length < minSecretLength || isDisallowedSecret(cfg.jwtAccessSecret)) {
    errors.push("JWT_ACCESS_SECRET must be at least 32 chars and not a placeholder.");
  }

  if (cfg.jwtRefreshSecret.length < minSecretLength || isDisallowedSecret(cfg.jwtRefreshSecret)) {
    errors.push("JWT_REFRESH_SECRET must be at least 32 chars and not a placeholder.");
  }

  let dbPassword = "";
  try {
    const dbUrl = new URL(cfg.dbUrl);
    dbPassword = decodeURIComponent(dbUrl.password || "");
  } catch {
    errors.push("DATABASE_URL must be a valid URL in production.");
  }

  if (!dbPassword || isDisallowedSecret(dbPassword)) {
    errors.push("DATABASE_URL must include a non-default password in production.");
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration is unsafe:\n- ${errors.join("\n- ")}`);
  }
};

export const config: Config = {
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
  animalsCsvPath: process.env.ANIMALS_CSV_PATH || "./data/ANIMAL_REG - data.csv",
};

assertProductionSafety(config);
