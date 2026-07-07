import type { FastifyInstance } from "fastify";
import type { PosModule } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { FiscalRepository } from "./repository/fiscal.repository.js";
import { FiscalService } from "./service/fiscal.service.js";
import { registerFiscalRoutes } from "./routes/fiscal.routes.js";

let _service: FiscalService | null = null;

export function getFiscalService(): FiscalService {
  if (_service === null) throw new Error("Fiscal module not initialized");
  return _service;
}

export const fiscalModule: PosModule = {
  name: "fiscal",
  version: "0.1.0",
  description: "Registratore Telematico integration for Italian fiscal compliance",
  permissions: ["fiscal:read", "fiscal:write"],
  events: [],
  routes: [
    { method: "GET",  path: "/fiscal/status",   description: "Check RT connectivity" },
    { method: "POST", path: "/fiscal/z-report",  description: "Emit Z-report" },
    { method: "POST", path: "/fiscal/void",       description: "Void fiscal document" },
  ],

  async init(ctx: CoreContext) {
    const repo = new FiscalRepository(ctx.db);
    _service = new FiscalService(repo, ctx.logger);
    await _service.loadSettings();

    // Subscribe to PAYMENT_COMPLETED — emit fiscal document automatically
    ctx.eventBus.on("PAYMENT_COMPLETED", async (payload) => {
      if (!_service) return;
      try {
        await _service.emitFiscalDocument(
          payload.payment.orderId,
          payload.payment.method as "cash" | "card" | "digital_wallet" | "tab",
          payload.payment.amount,
        );
      } catch (err) {
        ctx.logger.error({ err, orderId: payload.payment.orderId }, "Fiscal emission failed after payment");
      }
    });

    // Void fiscal document on refund
    ctx.eventBus.on("PAYMENT_REFUNDED", async (payload) => {
      if (!_service) return;
      try {
        await _service.emitVoidDocument(payload.orderId);
      } catch (err) {
        ctx.logger.error({ err, orderId: payload.orderId }, "Fiscal void failed after refund");
      }
    });

    ctx.logger.info({ enabled: _service.enabled }, "Fiscal module initialized");
  },

  async register(ctx: CoreContext) {
    if (_service === null) throw new Error("Fiscal module not initialized");
    const fastify = ctx.fastify as FastifyInstance & {
      authenticate: (req: import("fastify").FastifyRequest) => Promise<void>;
    };
    const svc = _service;
    await fastify.register(async (f) => {
      f.addHook("preHandler", fastify.authenticate);
      registerFiscalRoutes(f, svc);
    }, { prefix: "/api" });
  },

  async start() {},
  async stop() { _service = null; },
};
