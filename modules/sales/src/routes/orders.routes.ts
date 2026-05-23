import type { FastifyInstance } from "fastify";
import type { OrderService } from "../service/order.service.js";
import { OrderNotFoundError, OrderValidationError } from "../service/order.service.js";
import type { Order, OrderStatus } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { formatReceipt, type ReceiptLine } from "@pos/core";
import { eq, printers, receiptTemplates, orderItems, payments } from "@pos/db";

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
  service: OrderService,
  ctx?: CoreContext
): void {
  // GET /orders
  fastify.get("/orders", {
    schema: {
      tags: ["orders"],
      summary: "List orders",
      querystring: {
        type: "object",
        properties: {
          status:  { type: "string", enum: ["pending","confirmed","preparing","ready","completed","cancelled"] },
          shiftId: { type: "string" },
          from:    { type: "number" },
          to:      { type: "number" },
          limit:   { type: "integer", minimum: 1, maximum: 500, default: 100 },
          offset:  { type: "integer", minimum: 0, default: 0 },
        },
      },
      response: { 200: { type: "array", items: orderSchema } },
    },
  }, async (request, reply) => {
    const q = request.query as { status?: string; shiftId?: string; from?: number; to?: number; limit?: number; offset?: number };
    const filters: { status?: OrderStatus; shiftId?: string; from?: number; to?: number; limit?: number; offset?: number } = {};
    if (q.status !== undefined) filters.status = q.status as OrderStatus;
    if (q.shiftId !== undefined) filters.shiftId = q.shiftId;
    if (q.from !== undefined) filters.from = q.from;
    if (q.to !== undefined) filters.to = q.to;
    if (q.limit !== undefined) filters.limit = q.limit;
    if (q.offset !== undefined) filters.offset = q.offset;
    const list = await service.list(filters);
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
          shiftId: { type: "string" },
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

  // POST /orders/:id/reprint
  fastify.post("/orders/:id/reprint", {
    schema: {
      tags: ["orders"],
      summary: "Reprint receipt for an order",
      params: { type: "object", properties: { id: { type: "string" } } },
      body: {},
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } } },
        404: { type: "object", properties: { error: { type: "string" } } },
        503: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    if (!ctx) return reply.status(503).send({ error: "Printer service unavailable" });
    const { id } = request.params as { id: string };

    try {
      await service.getById(id);
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      throw err;
    }

    const { db, printerService } = ctx;

    const activePrinters = await db.select().from(printers).where(eq(printers.active, true));
    const receiptPrinter = activePrinters.find((p) => p.receiptEnabled);
    if (!receiptPrinter) return reply.status(503).send({ error: "No active receipt printer" });

    const templates = await db.select().from(receiptTemplates).where(eq(receiptTemplates.active, true));
    const template = templates[0];

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const pmts = await db.select().from(payments).where(eq(payments.orderId, id));
    const payment = pmts[0];

    const lines: ReceiptLine[] = [];
    lines.push({ type: "header", content: template?.headerText ?? "Ristampa scontrino" });
    lines.push({ type: "divider" });
    lines.push({ type: "item", left: "Ordine", right: `#${id.slice(-6).toUpperCase()}` });
    lines.push({ type: "divider" });
    for (const item of items) {
      lines.push({ type: "item", left: `${item.quantity}x ${item.name}`, right: `€${(item.unitPrice * item.quantity).toFixed(2)}` });
    }
    lines.push({ type: "divider" });
    const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    lines.push({ type: "total", left: "TOTALE", right: `€${total.toFixed(2)}` });
    if (payment) lines.push({ type: "item", left: "Pagamento", right: payment.method });
    lines.push({ type: "divider" });
    if (template?.footerText) {
      lines.push({ type: "text", content: "" });
      lines.push({ type: "text", content: template.footerText });
    }

    const content = formatReceipt(lines);
    await printerService.printDirect({
      printerId: receiptPrinter.id,
      content,
      type: "receipt",
      ...(receiptPrinter.host && receiptPrinter.port
        ? { printerConfig: { host: receiptPrinter.host, port: receiptPrinter.port } }
        : {}),
    });

    return reply.send({ ok: true });
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
