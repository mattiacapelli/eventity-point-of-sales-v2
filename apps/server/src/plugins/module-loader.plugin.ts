import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { PosRuntime } from "@pos/core";
import type { PosModule } from "@pos/shared-types";
import { eq, modules } from "@pos/db";

// In-memory cache: moduleName → enabled flag, refreshed on MODULE_STATE_CHANGED
const _moduleCache = new Map<string, boolean>();

declare module "fastify" {
  interface FastifyInstance {
    posRuntime: PosRuntime;
    moduleGuard: (moduleName: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const moduleLoaderPlugin: FastifyPluginAsync<{ modules?: PosModule[] }> = async (
  fastify,
  opts,
) => {
  const { db, eventBus } = fastify.ctx;

  const runtime = new PosRuntime(fastify.ctx);
  fastify.decorate("posRuntime", runtime);

  // Warm the cache from DB on startup
  const rows = await db.select({ name: modules.name, enabled: modules.enabled }).from(modules);
  for (const row of rows) _moduleCache.set(row.name, row.enabled ?? false);

  // Keep cache in sync when admin toggles a module
  eventBus.on("MODULE_STATE_CHANGED", (payload) => {
    _moduleCache.set(payload.moduleName, payload.enabled);
  });

  // preHandler factory: returns 503 if the named module is disabled
  fastify.decorate("moduleGuard", (moduleName: string) => {
    return async (_req: FastifyRequest, reply: FastifyReply) => {
      const enabled = _moduleCache.get(moduleName) ?? true;
      if (!enabled) {
        return reply.status(503).send({ error: `Module "${moduleName}" is disabled` });
      }
    };
  });

  for (const mod of opts.modules ?? []) {
    await runtime.use(mod);
  }

  fastify.addHook("onReady", async () => {
    await runtime.start();
    fastify.ctx.logger.info("All modules started");
  });

  fastify.addHook("onClose", async () => {
    await runtime.stop();
  });
};

export default fp(moduleLoaderPlugin, {
  name: "module-loader",
  dependencies: ["core-context"],
});
