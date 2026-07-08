import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import adminAuthRoutes from "./routes/admin-auth.routes.js";
import adminTenantsRoutes from "./routes/admin-tenants.routes.js";
import tenantMenuRoutes from "./routes/tenant-menu.routes.js";
import tenantOrdersRoutes from "./routes/tenant-orders.routes.js";

async function main() {
  const config = loadConfig();

  try { mkdirSync(dirname(config.dbPath), { recursive: true }); } catch { /* already exists */ }
  const db = createDb(config.dbPath);

  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(jwt, { secret: config.jwtSecret });

  await fastify.register(adminAuthRoutes, { config });
  await fastify.register(adminTenantsRoutes, { db });
  await fastify.register(tenantMenuRoutes, { db });
  await fastify.register(tenantOrdersRoutes, { db });

  fastify.get("/health", async () => ({ ok: true }));

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
