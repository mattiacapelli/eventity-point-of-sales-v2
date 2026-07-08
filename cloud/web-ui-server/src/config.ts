export interface Config {
  port: number;
  dbPath: string;
  superAdminEmail: string | undefined;
  superAdminPassword: string | undefined;
  jwtSecret: string;
  corsOrigin: string;
  logLevel: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env["PORT"] ?? 4000),
    dbPath: process.env["DB_PATH"] ?? "./data/web-ui.db",
    superAdminEmail: process.env["SUPERADMIN_EMAIL"],
    superAdminPassword: process.env["SUPERADMIN_PASSWORD"],
    jwtSecret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
    corsOrigin: process.env["CORS_ORIGIN"] ?? "*",
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };
}
