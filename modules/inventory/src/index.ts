import type { FastifyInstance } from "fastify";
import type { PosModule } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { InventoryRepository } from "./repository/inventory.repository.js";
import { InventoryService } from "./service/inventory.service.js";
import { registerInventoryRoutes } from "./routes/inventory.routes.js";

export { InventoryRepository } from "./repository/inventory.repository.js";
export { InventoryService, InventoryValidationError } from "./service/inventory.service.js";

let _service: InventoryService | null = null;

export function getInventoryService(): InventoryService {
  if (_service === null) throw new Error("Inventory module not initialized");
  return _service;
}

export const inventoryModule: PosModule = {
  name: "inventory",
  version: "0.2.0",
  description: "Inventory management — stock tracking, movements, ingredients",
  permissions: ["inventory:read", "inventory:write"],
  events: ["PAYMENT_COMPLETED"],
  routes: [
    { method: "GET",    path: "/inventory/items",                 description: "List inventory items" },
    { method: "POST",   path: "/inventory/items",                 description: "Create inventory item" },
    { method: "PATCH",  path: "/inventory/items/:id",             description: "Update inventory item" },
    { method: "DELETE", path: "/inventory/items/:id",             description: "Delete inventory item" },
    { method: "POST",   path: "/inventory/items/:id/adjust",      description: "Manual stock adjustment" },
    { method: "GET",    path: "/inventory/items/:id/movements",   description: "Item movements history" },
    { method: "GET",    path: "/inventory/movements",             description: "All movements" },
    { method: "GET",    path: "/inventory/alerts",                description: "Low stock alerts" },
    { method: "GET",    path: "/inventory/ingredients/:productId", description: "Product ingredients" },
    { method: "POST",   path: "/inventory/ingredients",           description: "Assign ingredient" },
    { method: "DELETE", path: "/inventory/ingredients/:id",       description: "Remove ingredient" },
  ],

  async init(ctx: CoreContext) {
    const repo = new InventoryRepository(ctx.db);
    _service = new InventoryService(repo, ctx.eventBus);

    ctx.eventBus.on("PAYMENT_COMPLETED", async (payload) => {
      if (_service === null) return;
      try {
        const { orderItems, eq } = await import("@pos/db");
        const items = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, payload.payment.orderId));
        await _service.decrementForOrder(
          payload.payment.orderId,
          items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        );
      } catch (err) {
        ctx.logger.error({ err }, "Inventory decrement failed");
      }
    });

    ctx.eventBus.on("SHIFT_OPENED", async () => {
      if (_service === null) return;
      try {
        await _service.resetStockForShift();
      } catch (err) {
        ctx.logger.error({ err }, "Inventory shift reset failed");
      }
    });

    ctx.logger.info("Inventory module initialized");
  },

  async register(ctx: CoreContext) {
    if (_service === null) throw new Error("Inventory module not initialized");
    const fastify = ctx.fastify as FastifyInstance & { moduleGuard?: (n: string) => (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void> };
    const svc = _service;
    const guard = fastify.moduleGuard?.("inventory");
    await fastify.register(async (f) => { registerInventoryRoutes(f, svc, guard); }, { prefix: "/api" });
  },

  async start() {},
  async stop() { _service = null; },
};
