import type { FastifyInstance } from "fastify";
import type { PosModule } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { PaymentRepository } from "./repository/payment.repository.js";
import { PaymentService } from "./service/payment.service.js";
import { registerPaymentRoutes } from "./routes/payment.routes.js";

export { PaymentRepository } from "./repository/payment.repository.js";
export { PaymentService, PaymentError } from "./service/payment.service.js";

let _service: PaymentService | null = null;

export function getPaymentService(): PaymentService {
  if (_service === null) throw new Error("Payments module not initialized");
  return _service;
}

export const paymentsModule: PosModule = {
  name: "payments",
  version: "0.1.0",
  description: "Payment processing — accept payment, emit PAYMENT_COMPLETED",
  permissions: ["payments:write", "orders:write"],
  events: ["PAYMENT_COMPLETED", "PAYMENT_FAILED"],
  routes: [
    { method: "POST", path: "/payments",              description: "Process payment" },
    { method: "GET",  path: "/payments/order/:orderId", description: "List payments for order" },
  ],

  async init(ctx: CoreContext) {
    const repo = new PaymentRepository(ctx.db);
    _service = new PaymentService(repo, ctx.eventBus);
    ctx.logger.info("Payments module initialized");
  },

  async register(ctx: CoreContext) {
    if (_service === null) throw new Error("Payments module not initialized");
    const fastify = ctx.fastify as FastifyInstance;
    const svc = _service;
    await fastify.register(async (f) => { registerPaymentRoutes(f, svc); }, { prefix: "/api" });
  },

  async start() {},
  async stop() { _service = null; },
};
