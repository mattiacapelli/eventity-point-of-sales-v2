import type { FastifyInstance } from "fastify";
import type { OrderService } from "../service/order.service.js";
import { OrderNotFoundError, OrderValidationError } from "../service/order.service.js";
import type { Order, OrderStatus } from "@pos/shared-types";

const orderItemSchema = {
  type: "object",
  required: ["productId", "name", "quantity"],
  properties: {
    productId: { type: "string" },
    name: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    selectedOptionIds: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
} as const;

const orderSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    tableId: { type: "string", nullable: true },
    eventId: { type: "string", nullable: true },
    status: { type: "string" },
    totalAmount: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    items: { type: "array", items: orderItemSchema },
  },
} as const;

export function registerOrderRoutes(
  fastify: FastifyInstance,
  service: OrderService
): void {
  // GET /orders
  fastify.get("/orders", {
    schema: {
      tags: ["orders"],
      summary: "List orders",
      querystring: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending","confirmed","preparing","ready","completed","cancelled"] },
        },
      },
      response: { 200: { type: "array", items: orderSchema } },
    },
  }, async (request, reply) => {
    const { status } = request.query as { status?: OrderStatus };
    const list = await service.list(status);
    return reply.send(list.map(serializeOrder));
  });

  // GET /orders/:id
  fastify.get("/orders/:id", {
    schema: {
      tags: ["orders"],
      summary: "Get order by ID",
      params: { type: "object", properties: { id: { type: "string" } } },
      response: {
        200: orderSchema,
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const order = await service.getById(id);
      return reply.send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      throw err;
    }
  });

  // POST /orders
  fastify.post("/orders", {
    schema: {
      tags: ["orders"],
      summary: "Create a new order",
      body: {
        type: "object",
        required: ["items"],
        properties: {
          tableId: { type: "string" },
          eventId: { type: "string" },
          items: { type: "array", items: orderItemSchema, minItems: 1 },
        },
      },
      response: {
        201: orderSchema,
        400: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    try {
      const order = await service.create(request.body as Parameters<typeof service.create>[0]);
      return reply.status(201).send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // PATCH /orders/:id/status
  fastify.patch("/orders/:id/status", {
    schema: {
      tags: ["orders"],
      summary: "Update order status",
      params: { type: "object", properties: { id: { type: "string" } } },
      body: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["confirmed","preparing","ready","completed","cancelled"] },
        },
      },
      response: {
        200: orderSchema,
        400: { type: "object", properties: { error: { type: "string" } } },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: OrderStatus };
    try {
      const order = await service.updateStatus(id, status);
      return reply.send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      if (err instanceof OrderValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // DELETE /orders/:id  (cancel)
  fastify.delete("/orders/:id", {
    schema: {
      tags: ["orders"],
      summary: "Cancel an order",
      params: { type: "object", properties: { id: { type: "string" } } },
      body: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
      response: {
        200: orderSchema,
        400: { type: "object", properties: { error: { type: "string" } } },
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.body ?? {}) as { reason?: string };
    try {
      const order = await service.cancel(id, reason);
      return reply.send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      if (err instanceof OrderValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });
}

function serializeOrder(order: Order) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    syncedAt: order.syncedAt?.toISOString() ?? null,
  };
}
