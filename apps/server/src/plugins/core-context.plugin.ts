import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { EventBus } from "@pos/event-bus";
import { createDbClientWithHandle, runMigrations } from "@pos/db";
import { createRootLogger, PrinterService } from "@pos/core";
import type { CoreContext, AppConfig } from "@pos/core";

declare module "fastify" {
  interface FastifyInstance {
    ctx: CoreContext;
  }
}

const coreContextPlugin: FastifyPluginAsync<{ config: AppConfig }> = async (fastify, opts) => {
  const { config } = opts;

  runMigrations(config.databaseUrl);

  const logger = createRootLogger(config);
  const eventBus = new EventBus({
    log: (event, traceId) => logger.debug({ event, traceId }, "event emitted"),
  });
  const { db, sqlite } = createDbClientWithHandle(config.databaseUrl);
  const printerService = new PrinterService(logger);

  const ctx: CoreContext = Object.freeze({ config, logger, eventBus, db, sqlite, printerService, fastify });

  fastify.decorate("ctx", ctx);

  fastify.addHook("onClose", async () => {
    await printerService.flush();
    eventBus.removeAllListeners();
  });
};

export default fp(coreContextPlugin, { name: "core-context" });
