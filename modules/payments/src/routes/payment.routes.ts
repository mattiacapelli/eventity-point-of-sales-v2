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

export function registerPaymentRoutes(fastify: FastifyInstance, service: PaymentService): void {
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
