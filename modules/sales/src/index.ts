import type { FastifyInstance } from "fastify";
import type { PosModule } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { OrderRepository } from "./repository/order.repository.js";
import { OrderService } from "./service/order.service.js";
import { registerOrderRoutes } from "./routes/orders.routes.js";

export { OrderRepository, formatReceiptNumber, computeVatBreakdown } from "./repository/order.repository.js";
export { OrderService, OrderNotFoundError, OrderValidationError } from "./service/order.service.js";

let _service: OrderService | null = null;

export function getOrderService(): OrderService {
  if (_service === null) throw new Error("Sales module not initialized");
  return _service;
}

export const salesModule: PosModule = {
  name: "sales",
  version: "0.1.0",
  description: "Order management — create, update, cancel orders",
  permissions: ["orders:read", "orders:write"],
  events: ["ORDER_CREATED", "ORDER_UPDATED", "ORDER_CANCELLED"],
  routes: [
    { method: "GET",    path: "/orders",           description: "List orders" },
    { method: "GET",    path: "/orders/:id",        description: "Get order" },
    { method: "POST",   path: "/orders",            description: "Create order" },
    { method: "PATCH",  path: "/orders/:id/status", description: "Update order status" },
    { method: "DELETE", path: "/orders/:id",        description: "Cancel order" },
  ],

  async init(ctx: CoreContext) {
    const repo = new OrderRepository(ctx.db);
    _service = new OrderService(repo, ctx.eventBus, ctx.db);
    _service.subscribeToStatusRequests();
    ctx.logger.info("Sales module initialized");
  },

  async register(ctx: CoreContext) {
    if (_service === null) throw new Error("Sales module not initialized");
    const fastify = ctx.fastify as FastifyInstance & {
      authenticate: (req: import("fastify").FastifyRequest) => Promise<void>;
      moduleGuard?: (n: string) => (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
    };
    const svc = _service;
    const guard = fastify.moduleGuard?.("sales");
    await fastify.register(async (f) => {
      f.addHook("preHandler", fastify.authenticate);
      if (guard) f.addHook("preHandler", guard);
      registerOrderRoutes(f, svc, ctx);
    }, { prefix: "/api" });
  },

  async start() {},
  async stop() { _service = null; },
};
