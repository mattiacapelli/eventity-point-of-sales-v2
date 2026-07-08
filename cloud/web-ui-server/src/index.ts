import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { sql } from "drizzle-orm";
import { seedSuperAdmin } from "./auth/seed-superadmin.js";
import adminAuthRoutes from "./routes/admin-auth.routes.js";
import adminTenantsRoutes from "./routes/admin-tenants.routes.js";
import adminUsersRoutes from "./routes/admin-users.routes.js";
import adminAuditRoutes from "./routes/admin-audit.routes.js";
import adminExportRoutes from "./routes/admin-export.routes.js";
import tenantMenuRoutes from "./routes/tenant-menu.routes.js";
import tenantOrdersRoutes from "./routes/tenant-orders.routes.js";

const START_TIME = Date.now();

async function main() {
  const config = loadConfig();
  const isDev = process.env["NODE_ENV"] !== "production";

  try { mkdirSync(dirname(config.dbPath), { recursive: true }); } catch { /* already exists */ }
  const db = createDb(config.dbPath);
  await seedSuperAdmin(db, config);

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      ...(isDev ? { transport: { target: "pino-pretty" } } : {}),
    },
  });

  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(jwt, { secret: config.jwtSecret });
  await fastify.register(rateLimit, { global: false });

  await fastify.register(adminAuthRoutes, { db });
  await fastify.register(adminTenantsRoutes, { db });
  await fastify.register(adminUsersRoutes, { db });
  await fastify.register(adminAuditRoutes, { db });
  await fastify.register(adminExportRoutes, { db });
  await fastify.register(tenantMenuRoutes, { db });
  await fastify.register(tenantOrdersRoutes, { db });

  fastify.get("/health", async () => {
    let dbOk = true;
    try {
      db.get(sql`SELECT 1`);
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      dbOk,
      version: process.env["npm_package_version"] ?? "0.1.0",
    };
  });

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
