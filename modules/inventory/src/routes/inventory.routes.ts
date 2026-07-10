import "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import type { InventoryService } from "../service/inventory.service.js";
import { InventoryValidationError } from "../service/inventory.service.js";

export function registerInventoryRoutes(
  fastify: FastifyInstance,
  service: InventoryService,
  moduleGuard?: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>,
): void {
  if (moduleGuard) fastify.addHook("preHandler", moduleGuard);
  // GET /inventory/items
  fastify.route({
    method: "GET",
    url: "/inventory/items",
    schema: { tags: ["inventory"], summary: "List all inventory items" },
    handler: async (_req, reply) => {
      const items = await service.listItems();
      reply.send(items);
    },
  });

  // POST /inventory/items
  fastify.route({
    method: "POST",
    url: "/inventory/items",
    schema: {
      tags: ["inventory"],
      summary: "Create inventory item",
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          sku: { type: "string" },
          unit: { type: "string" },
          currentStock: { type: "number" },
          minStock: { type: "number" },
          productionCenterId: { type: "string" },
          productId: { type: "string" },
          resetOnShiftOpen: { type: "boolean" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = req.body as {
        name: string;
        sku?: string;
        unit?: string;
        currentStock?: number;
        minStock?: number;
        productionCenterId?: string;
        productId?: string;
        resetOnShiftOpen?: boolean;
      };
      const item = await service.createItem(body);
      reply.status(201).send(item);
    },
  });

  // PATCH /inventory/items/:id
  fastify.route({
    method: "PATCH",
    url: "/inventory/items/:id",
    schema: {
      tags: ["inventory"],
      summary: "Update inventory item",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        name?: string;
        sku?: string | null;
        unit?: string;
        minStock?: number;
        productionCenterId?: string | null;
        productId?: string | null;
        resetOnShiftOpen?: boolean;
      };
      try {
        const item = await service.updateItem(id, body);
        reply.send(item);
      } catch (err) {
        if (err instanceof InventoryValidationError) {
          reply.status(404).send({ error: err.message });
        } else throw err;
      }
    },
  });

  // DELETE /inventory/items/:id
  fastify.route({
    method: "DELETE",
    url: "/inventory/items/:id",
    schema: {
      tags: ["inventory"],
      summary: "Delete inventory item",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        await service.deleteItem(id);
        reply.status(204).send();
      } catch (err) {
        if (err instanceof InventoryValidationError) {
          reply.status(404).send({ error: err.message });
        } else throw err;
      }
    },
  });

  // POST /inventory/items/:id/adjust
  fastify.route({
    method: "POST",
    url: "/inventory/items/:id/adjust",
    schema: {
      tags: ["inventory"],
      summary: "Manual stock adjustment",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      body: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const { quantity, reason } = req.body as { quantity: number; reason?: string };
      try {
        const item = await service.adjustStock(id, quantity, reason);
        reply.send(item);
      } catch (err) {
        if (err instanceof InventoryValidationError) {
          reply.status(404).send({ error: err.message });
        } else throw err;
      }
    },
  });

  // GET /inventory/items/:id/movements
  fastify.route({
    method: "GET",
    url: "/inventory/items/:id/movements",
    schema: {
      tags: ["inventory"],
      summary: "Get movements for an item",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const movements = await service.getItemMovements(id);
      reply.send(movements);
    },
  });

  // GET /inventory/movements
  fastify.route({
    method: "GET",
    url: "/inventory/movements",
    schema: {
      tags: ["inventory"],
      summary: "List inventory movements",
      querystring: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["sale", "restock", "manual", "waste"] },
          from: { type: "number" },
          to: { type: "number" },
        },
      },
    },
    handler: async (req, reply) => {
      const q = req.query as { type?: string; from?: number; to?: number };
      const filters: Parameters<typeof service.listMovements>[0] = {};
      if (q.type !== undefined) filters.type = q.type as "sale" | "restock" | "manual" | "waste";
      if (q.from !== undefined) filters.from = Number(q.from);
      if (q.to !== undefined) filters.to = Number(q.to);
      const movements = await service.listMovements(filters);
      reply.send(movements);
    },
  });

  // GET /inventory/items/by-product/:productId
  fastify.route({
    method: "GET",
    url: "/inventory/items/by-product/:productId",
    schema: {
      tags: ["inventory"],
      summary: "Get inventory items linked to a product",
      params: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { productId } = req.params as { productId: string };
      const items = await service.getItemsByProduct(productId);
      reply.send(items);
    },
  });

  // GET /inventory/alerts
  fastify.route({
    method: "GET",
    url: "/inventory/alerts",
    schema: { tags: ["inventory"], summary: "Items below minimum stock threshold" },
    handler: async (_req, reply) => {
      const alerts = await service.getLowStockAlerts();
      reply.send(alerts);
    },
  });

  // GET /inventory/ingredients/:productId
  fastify.route({
    method: "GET",
    url: "/inventory/ingredients/:productId",
    schema: {
      tags: ["inventory"],
      summary: "Get ingredients for a product",
      params: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { productId } = req.params as { productId: string };
      const ingredients = await service.getIngredientsByProduct(productId);
      reply.send(ingredients);
    },
  });

  // POST /inventory/ingredients
  fastify.route({
    method: "POST",
    url: "/inventory/ingredients",
    schema: {
      tags: ["inventory"],
      summary: "Assign ingredient to product",
      body: {
        type: "object",
        required: ["productId", "inventoryItemId"],
        properties: {
          productId: { type: "string" },
          inventoryItemId: { type: "string" },
          quantity: { type: "number" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = req.body as { productId: string; inventoryItemId: string; quantity?: number };
      const ingredient = await service.createIngredient(body);
      reply.status(201).send(ingredient);
    },
  });

  // DELETE /inventory/ingredients/:id
  fastify.route({
    method: "DELETE",
    url: "/inventory/ingredients/:id",
    schema: {
      tags: ["inventory"],
      summary: "Remove ingredient assignment",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      await service.deleteIngredient(id);
      reply.status(204).send();
    },
  });
}
