import type { AppConfig } from "../config/config-loader.js";
import type { Logger } from "../logger/logger.js";
import type { EventBus } from "@pos/event-bus";
import type { DbClient } from "@pos/db";
import type { PrinterService } from "../printer/printer.service.js";

/** Minimal interface for the raw SQLite handle — only the methods we need. */
export interface SqliteHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backup(filename: string): Promise<any>;
}

/**
 * CoreContext is the single shared object passed to every module and plugin.
 * fastify is typed as `unknown` here to avoid importing Fastify types into
 * @pos/core. Modules that need it cast it to FastifyInstance from their own
 * import of fastify.
 */
export interface CoreContext {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly eventBus: EventBus;
  readonly db: DbClient;
  readonly sqlite: SqliteHandle;
  readonly printerService: PrinterService;
  readonly fastify: unknown;
}
