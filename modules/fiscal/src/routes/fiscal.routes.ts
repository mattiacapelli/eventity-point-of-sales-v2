import "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import type { FiscalService } from "../service/fiscal.service.js";

export function registerFiscalRoutes(fastify: FastifyInstance, service: FiscalService): void {
  // GET /api/fiscal/status — controlla connessione RT
  fastify.get("/fiscal/status", {
    schema: { tags: ["fiscal"], summary: "Check RT connectivity" },
  }, async (_req, reply) => {
    const online = await service.ping();
    return reply.send({ enabled: service.enabled, online });
  });

  // POST /api/fiscal/z-report — chiusura giornaliera RT
  fastify.post("/fiscal/z-report", {
    schema: { tags: ["fiscal"], summary: "Emit fiscal Z-report for a shift" },
  }, async (request, reply) => {
    const { shiftId } = request.body as { shiftId: number };
    if (!shiftId) return reply.status(400).send({ error: "shiftId required" });
    try {
      const result = await service.emitZReport(shiftId);
      return reply.send(result);
    } catch (err) {
      return reply.status(502).send({ error: err instanceof Error ? err.message : "Fiscal error" });
    }
  });

  // POST /api/fiscal/void — annulla documento commerciale
  fastify.post("/fiscal/void", {
    schema: { tags: ["fiscal"], summary: "Void a fiscal document for an order" },
  }, async (request, reply) => {
    const { orderId } = request.body as { orderId: number };
    if (!orderId) return reply.status(400).send({ error: "orderId required" });
    try {
      await service.emitVoidDocument(orderId);
      return reply.send({ ok: true });
    } catch (err) {
      return reply.status(502).send({ error: err instanceof Error ? err.message : "Fiscal error" });
    }
  });
}
