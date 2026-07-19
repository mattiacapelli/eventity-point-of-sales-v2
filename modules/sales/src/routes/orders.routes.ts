import type { FastifyInstance } from "fastify";
import type { OrderService } from "../service/order.service.js";
import { OrderNotFoundError, OrderValidationError } from "../service/order.service.js";
import type { Order, OrderStatus } from "@pos/shared-types";
import type { CoreContext } from "@pos/core";
import { formatKitchenTicket, renderPool } from "@pos/core";
import { eq, inArray, and, printers, orderItems, orderItemOptions, payments, orders, products, productionCenters, productionCenterCategories, productionCenterPrinters, kitchenTemplates, appSettings, terminals, paymentMethods, terminalPrinters } from "@pos/db";
import { formatReceiptNumber } from "../repository/order.repository.js";
import type { KitchenBlock } from "@pos/shared-types";

const orderItemOptionSchema = {
  type: "object",
  properties: {
    optionId: { type: "string" },
    optionName: { type: "string" },
    priceDelta: { type: "number" },
  },
} as const;

// Input shape for creating/updating an order: the client only picks products,
// prices are resolved server-side from the catalog.
const orderItemInputSchema = {
  type: "object",
  required: ["productId", "name", "quantity"],
  properties: {
    productId: { type: "integer" },
    name: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    selectedOptionIds: { type: "array", items: { type: "integer" } },
    customPriceDelta: { type: "number" },
    notes: { type: "string" },
  },
} as const;

// Output shape for an order item as persisted/returned by the server.
const orderItemSchema = {
  type: "object",
  required: ["productId", "name", "quantity", "unitPrice"],
  properties: {
    id: { type: "string" },
    productId: { type: "string" },
    name: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "number" },
    vatRate: { type: "number" },
    selectedOptionIds: { type: "array", items: { type: "string" } },
    options: { type: "array", items: orderItemOptionSchema },
    notes: { type: "string" },
  },
} as const;

const orderSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    tableId: { type: "string", nullable: true },
    customerName: { type: "string", nullable: true },
    eventId: { type: "string", nullable: true },
    terminalId: { type: "string", nullable: true },
    status: { type: "string" },
    totalAmount: { type: "number" },
    discountAmount: { type: "number" },
    discountType: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    pax: { type: "integer", nullable: true },
    receiptNumber: { type: "integer", nullable: true },
    shiftId: { type: "integer", nullable: true },
    fiscalDocNumber: { type: "string", nullable: true },
    fiscalDocDate: { type: "string", nullable: true },
    fiscalRtSerial: { type: "string", nullable: true },
    syncedAt: { type: "string", nullable: true },
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
          status:     { type: "string", enum: ["pending","confirmed","preparing","ready","completed","cancelled"] },
          shiftId:    { type: "string" },
          terminalId: { type: "string" },
          from:       { type: "number" },
          to:         { type: "number" },
          limit:      { type: "integer", minimum: 1, maximum: 500, default: 100 },
          offset:     { type: "integer", minimum: 0, default: 0 },
        },
      },
      response: { 200: { type: "array", items: orderSchema } },
    },
  }, async (request, reply) => {
    const q = request.query as { status?: string; shiftId?: string; terminalId?: string; from?: number; to?: number; limit?: number; offset?: number };
    const filters: { status?: OrderStatus; shiftId?: number; terminalId?: number; from?: number; to?: number; limit?: number; offset?: number } = {};
    if (q.status !== undefined) filters.status = q.status as OrderStatus;
    if (q.shiftId !== undefined) filters.shiftId = parseInt(q.shiftId, 10);
    if (q.terminalId !== undefined) filters.terminalId = parseInt(q.terminalId, 10);
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
      const order = await service.getById(parseInt(id, 10));
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
          tableId:        { type: "string" },
          eventId:        { type: "string" },
          shiftId:        { type: "string" },
          notes:          { type: "string" },
          discountAmount: { type: "number", minimum: 0 },
          discountType:   { type: "string" },
          pax:            { type: "integer", minimum: 1 },
          items:          { type: "array", items: orderItemInputSchema, minItems: 1 },
        },
      },
      response: {
        201: orderSchema,
        400: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const terminalIdHeader = (request.headers["x-terminal-id"] as string | undefined) ?? undefined;
    const terminalId = terminalIdHeader !== undefined ? parseInt(terminalIdHeader, 10) : undefined;
    const clientIp = request.ip;
    try {
      const input = request.body as Parameters<typeof service.create>[0];
      const order = await service.create({
        ...input,
        ...(terminalId !== undefined ? { terminalId } : {}),
      }, clientIp);
      return reply.status(201).send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderValidationError) return reply.status(400).send({ error: err.message });
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return reply.status(400).send({ error: "Riferimento non valido: turno o terminale non esistente. Ricarica la pagina." });
      }
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
      const order = await service.updateStatus(parseInt(id, 10), status);
      return reply.send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      if (err instanceof OrderValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // PATCH /orders/:id/details
  fastify.patch("/orders/:id/details", {
    schema: {
      tags: ["orders"],
      summary: "Update table number / customer name on an order",
      params: { type: "object", properties: { id: { type: "string" } } },
      body: {
        type: "object",
        properties: {
          tableId: { type: "string", nullable: true },
          customerName: { type: "string", nullable: true },
        },
      },
      response: {
        200: orderSchema,
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { tableId?: string | null; customerName?: string | null };
    try {
      const order = await service.updateDetails(parseInt(id, 10), body);
      return reply.send(serializeOrder(order));
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      throw err;
    }
  });

  // PATCH /orders/:id/items  — replace order items (edit in progress order)
  fastify.patch("/orders/:id/items", {
    schema: {
      tags: ["orders"],
      summary: "Replace items on an in-progress order",
      params: { type: "object", properties: { id: { type: "string" } } },
      body: {
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: orderItemInputSchema, minItems: 1 },
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
    const { items } = request.body as { items: Array<{ productId: number; name: string; quantity: number; selectedOptionIds?: number[]; customPriceDelta?: number; notes?: string }> };
    try {
      const order = await service.updateItems(parseInt(id, 10), items);
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
      const order = await service.cancel(parseInt(id, 10), reason);
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
    const numId = parseInt(id, 10);

    let order: Order;
    try {
      order = await service.getById(numId);
    } catch (err) {
      if (err instanceof OrderNotFoundError) return reply.status(404).send({ error: err.message });
      throw err;
    }

    const { db, eventBus } = ctx;

    // Resolve the terminal that is requesting the reprint (from header)
    const terminalIdHeader = (request.headers["x-terminal-id"] as string | undefined);
    const requestingTerminalId = terminalIdHeader !== undefined ? parseInt(terminalIdHeader, 10) : undefined;

    // Check that at least one receipt printer is reachable
    const activePrinters = await db.select().from(printers).where(eq(printers.active, true));
    let receiptPrinter = activePrinters.find((p) => p.receiptEnabled);
    if (requestingTerminalId) {
      const tpRows = await db.select({ printerId: terminalPrinters.printerId })
        .from(terminalPrinters).where(eq(terminalPrinters.terminalId, requestingTerminalId));
      if (tpRows.length > 0) {
        const tpIds = new Set(tpRows.map((r) => r.printerId));
        const tp = activePrinters.find((p) => tpIds.has(p.id) && p.receiptEnabled);
        if (tp) receiptPrinter = tp;
      }
    }
    if (!receiptPrinter) return reply.status(503).send({ error: "No active receipt printer" });

    // Find the original completed payment for this order
    const pmts = await db.select().from(payments).where(and(eq(payments.orderId, numId), eq(payments.status, "completed")));
    const payment = pmts[0];
    if (!payment) return reply.status(404).send({ error: "No completed payment found for this order" });

    // Reuse the full PRINT_JOB_QUEUED flow — same template, same renderer
    const jobId = crypto.randomUUID();
    eventBus.emit("PRINT_JOB_QUEUED", {
      traceId: crypto.randomUUID(),
      jobId,
      type: "receipt",
      payload: {
        orderId:  payment.orderId,
        amount:   payment.amount,
        currency: payment.currency,
        method:   payment.method,
        paidAt:   payment.createdAt,
        ...(requestingTerminalId !== undefined ? { terminalId: requestingTerminalId } : {}),
      },
      timestamp: new Date(),
    });

    return reply.send({ ok: true });
  });

  // POST /orders/:id/reprint-kitchen
  fastify.post("/orders/:id/reprint-kitchen", {
    schema: {
      tags: ["orders"],
      summary: "Reprint kitchen ticket for an order",
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
    const numId2 = parseInt(id, 10);

    const [orderRow] = await ctx.db.select().from(orders).where(eq(orders.id, numId2));
    if (!orderRow) return reply.status(404).send({ error: "Order not found" });

    const { db, printerService, logger } = ctx;

    const allActivePrinters = await db.select().from(printers).where(eq(printers.active, true));
    const allKitchenPrinters = allActivePrinters.filter((p) => p.kitchenEnabled);
    if (allKitchenPrinters.length === 0) return reply.status(503).send({ error: "No active kitchen printers" });

    // Load receipt number settings for display
    const settingKeys = ["receipt_number_prefix", "receipt_number_padding"] as const;
    const settingRows = await db.select().from(appSettings).where(inArray(appSettings.key, settingKeys as unknown as string[]));
    const sMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
    const receiptDisplay = formatReceiptNumber(
      orderRow.receiptNumber ?? undefined,
      numId2,
      sMap["receipt_number_prefix"] ?? "",
      parseInt(sMap["receipt_number_padding"] ?? "0", 10),
    );

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, numId2)) as Array<{
      id: number; productId: number; name: string; quantity: number; unitPrice: number; notes: string | null;
    }>;

    if (items.length === 0) return reply.send({ ok: true });

    // Load options
    const itemIds = items.map((i) => i.id);
    const optionRows = await db.select().from(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds)) as Array<{
      orderItemId: number; optionId: number; optionName: string; priceDelta: number;
    }>;
    const optsByItemId = new Map<number, Array<{ optionName: string; priceDelta: number }>>();
    for (const opt of optionRows) {
      const arr = optsByItemId.get(opt.orderItemId) ?? [];
      arr.push({ optionName: opt.optionName, priceDelta: opt.priceDelta });
      optsByItemId.set(opt.orderItemId, arr);
    }

    // Group items by production center — batch-loaded to avoid N+1
    const centerItems = new Map<string, { centerName: string; items: typeof items }>();
    const unroutedItems: typeof items = [];

    const productIds = [...new Set(items.map((i) => i.productId))];
    const productCatRows = productIds.length > 0
      ? await db.select({ id: products.id, categoryId: products.categoryId })
          .from(products).where(inArray(products.id, productIds))
      : [];
    const productCatMap = new Map(productCatRows.map((r) => [r.id, r.categoryId]));

    const catIds = [...new Set(productCatRows.map((r) => r.categoryId).filter((cid): cid is number => cid !== null && cid !== undefined))];
    const pcCatRows = catIds.length > 0
      ? await db.select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
          .from(productionCenterCategories).where(inArray(productionCenterCategories.categoryId, catIds))
      : [];
    const catToCenters = new Map<number, number[]>();
    for (const r of pcCatRows) {
      const arr = catToCenters.get(r.categoryId) ?? [];
      arr.push(r.productionCenterId);
      catToCenters.set(r.categoryId, arr);
    }

    const centerIds = [...new Set(pcCatRows.map((r) => r.productionCenterId))];
    const centerNameRows = centerIds.length > 0
      ? await db.select({ id: productionCenters.id, name: productionCenters.name })
          .from(productionCenters).where(inArray(productionCenters.id, centerIds))
      : [];
    const centerNameMap = new Map(centerNameRows.map((r) => [r.id, r.name]));

    for (const item of items) {
      const categoryId = productCatMap.get(item.productId) ?? null;
      if (categoryId === null || categoryId === undefined) { unroutedItems.push(item); continue; }
      const centerIdList = catToCenters.get(categoryId) ?? [];
      if (centerIdList.length === 0) { unroutedItems.push(item); continue; }
      for (const centerId of centerIdList) {
        const existing = centerItems.get(String(centerId));
        if (existing) {
          existing.items.push(item);
        } else {
          centerItems.set(String(centerId), { centerName: centerNameMap.get(centerId) ?? "Cucina", items: [item] });
        }
      }
    }
    if (unroutedItems.length > 0) {
      logger.debug({ orderId: numId2, count: unroutedItems.length }, "Kitchen reprint: items without production center — skipping");
    }

    const now = new Date();
    const tableId = orderRow.tableId ?? null;
    const customerName = orderRow.customerName ?? null;

    for (const [centerIdStr, { centerName, items: centerGroupItems }] of centerItems) {
      const centerId = parseInt(centerIdStr, 10);
      const dedicatedRows = await db.select({ printerId: productionCenterPrinters.printerId })
        .from(productionCenterPrinters)
        .where(eq(productionCenterPrinters.productionCenterId, centerId));
      if (dedicatedRows.length === 0) {
        logger.debug({ orderId: numId2, centerId, centerName }, "Kitchen reprint: production center has no dedicated printers — skipping");
        continue;
      }
      const dedicatedIds = dedicatedRows.map((r) => r.printerId);
      const targetPrinters = allKitchenPrinters.filter((p) => dedicatedIds.includes(p.id));
      if (targetPrinters.length === 0) {
        logger.debug({ orderId: numId2, centerId, centerName }, "Kitchen reprint: dedicated printers not active — skipping");
        continue;
      }

      const ticketItems = centerGroupItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        options: optsByItemId.get(i.id) ?? [],
        ...(i.notes ? { notes: i.notes } : {}),
      }));

      await Promise.allSettled(targetPrinters.map(async (printer) => {
        const connType = (printer as unknown as { connectionType: string }).connectionType;
        const vid = (printer as unknown as { usbVendorId: number | null }).usbVendorId;
        const pid = (printer as unknown as { usbProductId: number | null }).usbProductId;
        const winName = (printer as unknown as { winPrinterName: string | null }).winPrinterName;
        const printerConfig =
          connType === "usb" && vid && pid
            ? { connectionType: "usb" as const, usbVendorId: vid, usbProductId: pid }
            : connType === "windows" && winName
              ? { connectionType: "windows" as const, winPrinterName: winName }
              : printer.host && printer.port
                ? { connectionType: "network" as const, host: printer.host, port: printer.port }
                : null;
        if (!printerConfig) return;
        try {
          if ((printer as unknown as { printMode: string }).printMode === "image") {
            const templateRows = await db.select().from(kitchenTemplates).where(eq(kitchenTemplates.active, true));
            const numCenterId = centerIdStr !== "__generale__" ? parseInt(centerIdStr, 10) : null;
            const template = (numCenterId !== null ? templateRows.find((t) => t.productionCenterId === numCenterId) : undefined) ?? templateRows[0];
            if (template?.blocks) {
              const blocks = typeof template.blocks === "string" ? JSON.parse(template.blocks) : template.blocks;
              const rasterBuffer = await renderPool.renderKitchen({
                blocks: blocks as KitchenBlock[],
                canvasWidth: template.canvasWidth ?? 576,
                logoPath: template.logoPath ?? null,
                centerName,
                orderId: numId2,
                receiptDisplay,
                tableId,
                customerName,
                timestamp: now,
                items: ticketItems,
              });
              await printerService.printDirect({ printerId: printer.id, contentBuffer: rasterBuffer, type: "kitchen", printerConfig });
              return;
            }
          }
          const content = formatKitchenTicket({ orderId: numId2, receiptDisplay, tableId, customerName, centerName, timestamp: now, orderNotes: orderRow.notes, pax: orderRow.pax, items: ticketItems });
          await printerService.printDirect({ printerId: printer.id, content, type: "kitchen", printerConfig });
        } catch (err) {
          logger.error({ err, printerId: printer.id, orderId: id }, "Reprint kitchen ticket failed");
        }
      }));
    }

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
