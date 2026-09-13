export interface Config {
  port: number;
  dbPath: string;
  dataDir: string;
  superAdminEmail: string | undefined;
  superAdminPassword: string | undefined;
  jwtSecret: string;
  corsOrigin: string | string[];
  logLevel: string;
}

export function loadConfig(): Config {
  const isProduction = process.env["NODE_ENV"] === "production";

  const jwtSecret = process.env["JWT_SECRET"];
  if (isProduction && !jwtSecret) {
    throw new Error("JWT_SECRET must be set in production — refusing to start with an insecure default.");
  }

  const corsOrigin = process.env["CORS_ORIGIN"];
  if (isProduction && !corsOrigin) {
    console.warn("[config] CORS_ORIGIN is not set in production — falling back to \"*\" (allow any origin).");
  }

  const corsOriginList = corsOrigin
    ? corsOrigin.split(",").map((o) => o.trim()).filter(Boolean)
    : undefined;

  return {
    port: Number(process.env["PORT"] ?? 4000),
    dbPath: process.env["DB_PATH"] ?? "./data/web-ui.db",
    dataDir: process.env["DATA_DIR"] ?? "./data",
    superAdminEmail: process.env["SUPERADMIN_EMAIL"],
    superAdminPassword: process.env["SUPERADMIN_PASSWORD"],
    jwtSecret: jwtSecret ?? "dev-secret-change-in-production",
    corsOrigin: corsOriginList && corsOriginList.length > 1 ? corsOriginList : (corsOriginList?.[0] ?? "*"),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };
}
