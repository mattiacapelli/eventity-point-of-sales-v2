import { z } from "zod";

const INSECURE_JWT_DEFAULT = "change-me-in-production-minimum-32-chars!";

const ConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.coerce.number().int().positive().default(3000),
  databaseUrl: z.string().default("./pos.db"),
  sessionTtlSeconds: z.coerce.number().int().positive().default(2592000), // 30 days
  jwtSecret: z.string().min(32).default(INSECURE_JWT_DEFAULT),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  env: z.enum(["development", "production", "test"]).default("development"),
  // Comma-separated list of allowed CORS origins. Empty = allow all (development only).
  corsOrigins: z.string().default(""),
  // Timezone for receipt timestamps (IANA format e.g. "Europe/Rome")
  timezone: z.string().default("Europe/Rome"),
  // Base directory for persistent data (logos, fonts, images). Defaults to /data in production.
  dataDir: z.string().default("/data"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export { INSECURE_JWT_DEFAULT };

export function loadConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  const raw = {
    host: overrides["HOST"] ?? process.env["HOST"],
    port: overrides["PORT"] ?? process.env["PORT"],
    databaseUrl: overrides["DATABASE_URL"] ?? process.env["DATABASE_URL"],
    sessionTtlSeconds: overrides["SESSION_TTL_SECONDS"] ?? process.env["SESSION_TTL_SECONDS"],
    jwtSecret: overrides["JWT_SECRET"] ?? process.env["JWT_SECRET"],
    logLevel: overrides["LOG_LEVEL"] ?? process.env["LOG_LEVEL"],
    env: overrides["NODE_ENV"] ?? process.env["NODE_ENV"],
    corsOrigins: overrides["CORS_ORIGINS"] ?? process.env["CORS_ORIGINS"],
    timezone: overrides["TZ"] ?? process.env["TZ"],
    dataDir: overrides["DATA_DIR"] ?? process.env["DATA_DIR"],
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${result.error.toString()}`);
  }

  const config = result.data;

  if (config.env === "production" && config.jwtSecret === INSECURE_JWT_DEFAULT) {
    throw new Error(
      "JWT_SECRET must be set to a strong secret in production. " +
      "The default value is publicly known and must not be used."
    );
  }

  return Object.freeze(config);
}
