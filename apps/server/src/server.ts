import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import swaggerPlugin from "./plugins/swagger.plugin.js";
import coreContextPlugin from "./plugins/core-context.plugin.js";
import authPlugin from "./plugins/auth.plugin.js";
import moduleLoaderPlugin from "./plugins/module-loader.plugin.js";
import printerTriggerPlugin from "./plugins/printer-trigger.plugin.js";
import wsGateway from "./ws/ws-gateway.js";
import healthRoute from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import diagnosticsRoutes from "./routes/diagnostics.js";
import { salesModule } from "@pos/module-sales";
import { kitchenModule } from "@pos/module-kitchen";
import { paymentsModule } from "@pos/module-payments";
import { inventoryModule } from "@pos/module-inventory";
import { fiscalModule } from "@pos/module-fiscal";
import type { AppConfig } from "@pos/core";
import categoriesRoutes from "./routes/admin/categories.js";
import productsRoutes from "./routes/admin/products.js";
import productionCentersRoutes from "./routes/admin/production-centers.js";
import optionGroupsRoutes from "./routes/admin/option-groups.js";
import paymentMethodsRoutes from "./routes/admin/payment-methods.js";
import printersRoutes from "./routes/admin/printers.js";
import receiptTemplatesRoutes from "./routes/admin/receipt-templates.js";
import shiftsRoutes from "./routes/admin/shifts.js";
import bootstrapRoutes from "./routes/bootstrap.js";
import backupsRoutes from "./routes/admin/backups.js";
import appSettingsRoutes from "./routes/admin/app-settings.js";
import modulesRoutes from "./routes/admin/modules.js";
import restaurantRoutes from "./routes/admin/restaurant.js";
import statsRoutes from "./routes/stats.js";
import kitchenTemplatesRoutes from "./routes/admin/kitchen-templates.js";
import shiftReportTemplatesRoutes from "./routes/admin/shift-report-templates.js";
import gridLayoutsRoutes from "./routes/admin/grid-layouts.js";
import auditLogRoutes from "./routes/admin/audit-log.js";
import printLogRoutes from "./routes/admin/print-log.js";
import terminalsRoutes from "./routes/admin/terminals.js";
import usersRoutes from "./routes/admin/users.js";
import factoryResetRoutes from "./routes/admin/factory-reset.js";
import dailyExtrasRoutes from "./routes/admin/daily-extras.js";

export async function buildServer(config: AppConfig) {
  const fastify = Fastify({
    logger: false, // pino logger is managed by CoreContext
  });

  // Infrastructure — CORS: allow configured origins or all in development
  const corsOrigin: string | boolean | string[] =
    config.corsOrigins !== ""
      ? config.corsOrigins.split(",").map((o) => o.trim())
      : config.env === "development"
        ? true
        : false;
  await fastify.register(cors, { origin: corsOrigin, credentials: true });
  await fastify.register(websocket);
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max
  await fastify.register(fastifyStatic, {
    root: resolve(config.dataDir),
    prefix: "/api/static/",
    decorateReply: false,
  });
  await fastify.register(swaggerPlugin);

  // Global error handler — catches unhandled route errors, logs them and
  // returns a safe JSON response without leaking stack traces to the client.
  fastify.setErrorHandler((err, request, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      // Use pino logger if available (after coreContextPlugin), otherwise console
      const log = (fastify as unknown as { ctx?: { logger?: { error: (...a: unknown[]) => void } } }).ctx?.logger;
      if (log) log.error({ err, method: request.method, url: request.url }, "Unhandled route error");
      else console.error("[server] Unhandled route error", err);
    }
    void reply.status(status).send({
      error: status >= 500 ? "Internal server error" : (err.message || "Request failed"),
    });
  });

  // Core — must be first so ctx is available to everything below
  await fastify.register(coreContextPlugin, { config });
  await fastify.register(authPlugin);
  await fastify.register(moduleLoaderPlugin, {
    modules: [salesModule, kitchenModule, paymentsModule, inventoryModule, fiscalModule],
  });
  await fastify.register(printerTriggerPlugin);
  await fastify.register(wsGateway);

  // Routes
  await fastify.register(healthRoute);
  await fastify.register(authRoutes, { prefix: "/api" });
  await fastify.register(diagnosticsRoutes, { prefix: "/api" });
  await fastify.register(categoriesRoutes, { prefix: "/api" });
  await fastify.register(productsRoutes, { prefix: "/api" });
  await fastify.register(productionCentersRoutes, { prefix: "/api" });
  await fastify.register(optionGroupsRoutes, { prefix: "/api" });
  await fastify.register(paymentMethodsRoutes, { prefix: "/api" });
  await fastify.register(printersRoutes, { prefix: "/api" });
  await fastify.register(receiptTemplatesRoutes, { prefix: "/api" });
  await fastify.register(shiftsRoutes, { prefix: "/api" });
  await fastify.register(bootstrapRoutes, { prefix: "/api" });
  await fastify.register(backupsRoutes, { prefix: "/api" });
  await fastify.register(appSettingsRoutes, { prefix: "/api" });
  await fastify.register(modulesRoutes, { prefix: "/api" });
  await fastify.register(restaurantRoutes, { prefix: "/api" });
  await fastify.register(statsRoutes, { prefix: "/api" });
  await fastify.register(kitchenTemplatesRoutes, { prefix: "/api" });
  await fastify.register(shiftReportTemplatesRoutes, { prefix: "/api" });
  await fastify.register(gridLayoutsRoutes, { prefix: "/api" });
  await fastify.register(auditLogRoutes, { prefix: "/api" });
  await fastify.register(printLogRoutes, { prefix: "/api" });
  await fastify.register(terminalsRoutes, { prefix: "/api" });
  await fastify.register(usersRoutes, { prefix: "/api" });
  await fastify.register(factoryResetRoutes, { prefix: "/api" });
  await fastify.register(dailyExtrasRoutes, { prefix: "/api" });

  return fastify;
}
