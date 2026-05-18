import type { FastifyInstance } from "fastify";
import type { PosModule } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { KitchenRepository } from "./repository/kitchen.repository.js";
import { KitchenService } from "./service/kitchen.service.js";
import { registerKitchenRoutes } from "./routes/kitchen.routes.js";

export { KitchenRepository } from "./repository/kitchen.repository.js";
export { KitchenService, KitchenValidationError } from "./service/kitchen.service.js";

let _service: KitchenService | null = null;

export function getKitchenService(): KitchenService {
  if (_service === null) throw new Error("Kitchen module not initialized");
  return _service;
}

export const kitchenModule: PosModule = {
  name: "kitchen",
  version: "0.1.0",
  description: "Kitchen display — order queue and status transitions",
  permissions: ["orders:read", "orders:write"],
  events: ["ORDER_UPDATED", "ORDER_CANCELLED"],
  routes: [
    { method: "GET",   path: "/kitchen/queue",             description: "Kitchen order queue" },
    { method: "GET",   path: "/kitchen/orders/:id",        description: "Get order" },
    { method: "PATCH", path: "/kitchen/orders/:id/status", description: "Advance order status" },
  ],

  async init(ctx: CoreContext) {
    const repo = new KitchenRepository(ctx.db);
    _service = new KitchenService(repo, ctx.eventBus);
    ctx.logger.info("Kitchen module initialized");
  },

  async register(ctx: CoreContext) {
    if (_service === null) throw new Error("Kitchen module not initialized");
    const fastify = ctx.fastify as FastifyInstance;
    const svc = _service;
    await fastify.register(async (f) => { registerKitchenRoutes(f, svc); }, { prefix: "/api" });
  },

  async start() {},
  async stop() { _service = null; },
};
