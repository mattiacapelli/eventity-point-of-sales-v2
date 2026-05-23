import type { FastifyInstance } from "fastify";
import type { PaymentService } from "../service/payment.service.js";
import { PaymentError } from "../service/payment.service.js";
import type { Payment } from "@pos/shared-types";

function serializePayment(p: Payment) {
  return {
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    syncedAt: p.syncedAt instanceof Date ? p.syncedAt.toISOString() : (p.syncedAt ?? null),
  };
}

export function registerPaymentRoutes(
  fastify: FastifyInstance,
  service: PaymentService,
  moduleGuard?: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>,
): void {
  if (moduleGuard) fastify.addHook("preHandler", moduleGuard);
  // POST /payments — process a payment for an order
  fastify.route({
    method: "POST",
    url: "/payments",
    schema: {
      tags: ["payments"],
      summary: "Process a payment for an order",
      body: {
        type: "object",
        required: ["orderId", "method", "amount"],
        properties: {
          orderId:   { type: "string" },
          method:    { type: "string", enum: ["cash", "card", "digital_wallet", "tab"] },
          amount:    { type: "number", minimum: 0.01 },
          currency:  { type: "string" },
          reference: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = req.body as {
        orderId: string;
        method: "cash" | "card" | "digital_wallet" | "tab";
        amount: number;
        currency?: string;
        reference?: string;
      };
      try {
        const payment = await service.pay({
          orderId: body.orderId,
          method: body.method,
          amount: body.amount,
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.reference !== undefined ? { reference: body.reference } : {}),
        });
        reply.status(201).send(serializePayment(payment));
      } catch (err) {
        if (err instanceof PaymentError) {
          reply.status(422).send({ error: err.message });
        } else {
          throw err;
        }
      }
    },
  });

  // POST /payments/:id/refund — refund a completed payment
  fastify.route({
    method: "POST",
    url: "/payments/:id/refund",
    schema: {
      tags: ["payments"],
      summary: "Refund a completed payment",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const { reason } = (req.body ?? {}) as { reason?: string };
      try {
        const payment = await service.refund(id, reason);
        reply.send(serializePayment(payment));
      } catch (err) {
        if (err instanceof PaymentError) {
          reply.status(422).send({ error: err.message });
        } else {
          throw err;
        }
      }
    },
  });

  // GET /payments/order/:orderId — list payments for an order
  fastify.route({
    method: "GET",
    url: "/payments/order/:orderId",
    schema: {
      tags: ["payments"],
      summary: "List payments for an order",
      params: {
        type: "object",
        required: ["orderId"],
        properties: { orderId: { type: "string" } },
      },
    },
    handler: async (req, reply) => {
      const { orderId } = req.params as { orderId: string };
      const list = await service.getPaymentsForOrder(orderId);
      reply.send({ payments: list.map(serializePayment) });
    },
  });
}
