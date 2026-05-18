import "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import type { KitchenService } from "../service/kitchen.service.js";
import { KitchenValidationError } from "../service/kitchen.service.js";
import type { Order, OrderStatus } from "@pos/shared-types";

function serializeOrder(order: Order) {
  return {
    ...order,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
    syncedAt: order.syncedAt instanceof Date ? order.syncedAt.toISOString() : (order.syncedAt ?? null),
  };
}

export function registerKitchenRoutes(fastify: FastifyInstance, service: KitchenService): void {
  // GET /kitchen/queue — active orders for kitchen display
  fastify.route({
    method: "GET",
    url: "/kitchen/queue",
    schema: {
      tags: ["kitchen"],
      summary: "Get kitchen order queue",
    },
    handler: async (_req, reply) => {
      const orders = await service.getQueue();
      reply.send({ orders: orders.map(serializeOrder) });
    },
  });

  // GET /kitchen/orders/:id
  fastify.route({
    method: "GET",
    url: "/kitchen/orders/:id",
    schema: {
      tags: ["kitchen"],
      summary: "Get single order for kitchen",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const order = await service.getOrder(id);
        reply.send(serializeOrder(order));
      } catch (err) {
        if (err instanceof KitchenValidationError) {
          reply.status(404).send({ error: err.message });
        } else {
          throw err;
        }
      }
    },
  });

  // PATCH /kitchen/orders/:id/status — transition status
  fastify.route({
    method: "PATCH",
    url: "/kitchen/orders/:id/status",
    schema: {
      tags: ["kitchen"],
      summary: "Advance order status in kitchen flow",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["confirmed", "preparing", "ready", "completed", "cancelled"],
          },
        },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: OrderStatus };
      try {
        const order = await service.requestTransition(id, status);
        reply.send(serializeOrder(order));
      } catch (err) {
        if (err instanceof KitchenValidationError) {
          reply.status(422).send({ error: err.message });
        } else {
          throw err;
        }
      }
    },
  });
}
