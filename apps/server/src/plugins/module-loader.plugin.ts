import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { PosRuntime } from "@pos/core";
import type { PosModule } from "@pos/shared-types";

declare module "fastify" {
  interface FastifyInstance {
    posRuntime: PosRuntime;
  }
}

const moduleLoaderPlugin: FastifyPluginAsync<{ modules?: PosModule[] }> = async (
  fastify,
  opts,
) => {
  const runtime = new PosRuntime(fastify.ctx);
  fastify.decorate("posRuntime", runtime);

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
