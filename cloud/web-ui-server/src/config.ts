export interface Config {
  port: number;
  dbPath: string;
  adminUsername: string;
  adminPassword: string;
  jwtSecret: string;
  corsOrigin: string;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env["PORT"] ?? 4000),
    dbPath: process.env["DB_PATH"] ?? "./data/web-ui.db",
    adminUsername: process.env["ADMIN_USERNAME"] ?? "admin",
    adminPassword: process.env["ADMIN_PASSWORD"] ?? "changeme",
    jwtSecret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
    corsOrigin: process.env["CORS_ORIGIN"] ?? "*",
  };
}
