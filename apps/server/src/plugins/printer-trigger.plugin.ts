import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, printers, receiptTemplates, orders, orderItems, products, productionCenters, productionCenterCategories, appSettings } from "@pos/db";
import { formatReceipt, formatKitchenTicket, type ReceiptLine } from "@pos/core";
import type { DbClient } from "@pos/db";
import type { PrinterService, Logger } from "@pos/core";

type OrderItemRow = { productId: string; quantity: number; name: string; unitPrice: number; notes: string | null };
type PrinterRow = { id: string; host: string | null; port: number | null; kitchenEnabled: boolean; receiptEnabled: boolean; active: boolean; name: string };

async function _isExpressMode(db: DbClient): Promise<boolean> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "express_mode"));
  return rows[0]?.value === "true";
}

async function _printKitchenTickets(
  db: DbClient,
  printerService: PrinterService,
  logger: Logger,
  orderId: string,
  items: OrderItemRow[],
): Promise<void> {
  if (items.length === 0) return;

  // Group items by production center
  const centerItems: Map<string, { centerName: string; items: OrderItemRow[] }> = new Map();
  const unroutedItems: OrderItemRow[] = [];

  for (const item of items) {
    // Find category of this product
    const [productRow] = await db.select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (!productRow?.categoryId) {
      unroutedItems.push(item);
      continue;
    }

    // Find production centers for this category
    const pcRows = await db.select({ productionCenterId: productionCenterCategories.productionCenterId })
      .from(productionCenterCategories)
      .where(eq(productionCenterCategories.categoryId, productRow.categoryId));

    if (pcRows.length === 0) {
      unroutedItems.push(item);
      continue;
    }

    for (const pcRow of pcRows) {
      const existing = centerItems.get(pcRow.productionCenterId);
      if (existing) {
        existing.items.push(item);
      } else {
        // Get production center name
        const [pcNameRow] = await db.select({ name: productionCenters.name })
          .from(productionCenters)
          .where(eq(productionCenters.id, pcRow.productionCenterId))
          .limit(1);
        centerItems.set(pcRow.productionCenterId, {
          centerName: pcNameRow?.name ?? "Cucina",
          items: [item],
        });
      }
    }
  }

  // If any unrouted items, add to a "Generale" bucket
  if (unroutedItems.length > 0) {
    centerItems.set("__generale__", { centerName: "Generale", items: unroutedItems });
  }

  // Get all active kitchen printers
  const activePrinters = await db.select().from(printers).where(eq(printers.active, true)) as unknown as PrinterRow[];
  const kitchenPrinters = activePrinters.filter((p) => p.kitchenEnabled);
  if (kitchenPrinters.length === 0) {
    logger.debug({ orderId }, "No active kitchen printers — skipping kitchen ticket");
    return;
  }

  const now = new Date();

  for (const [, { centerName, items: centerGroupItems }] of centerItems) {
    const ticketData = {
      orderId,
      centerName,
      timestamp: now,
      items: centerGroupItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        ...(i.notes ? { notes: i.notes } : {}),
      })),
    };

    const content = formatKitchenTicket(ticketData);

    for (const printer of kitchenPrinters) {
      if (!printer.host || !printer.port) continue;
      try {
        await printerService.printDirect({
          printerId: printer.id,
          content,
          type: "kitchen",
          printerConfig: { host: printer.host, port: printer.port },
        });
        logger.info({ printerId: printer.id, orderId, centerName }, "Kitchen ticket printed");
      } catch (err) {
        logger.error({ err, printerId: printer.id, orderId }, "Kitchen ticket print failed");
      }
    }
  }
}

const printerTriggerPlugin: FastifyPluginAsync = async (fastify) => {
  const { eventBus, logger, db, printerService } = fastify.ctx;

  // Kitchen ticket on ORDER_CREATED (Express OFF)
  eventBus.on("ORDER_CREATED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
    if (!claimed) return;

    const isExpress = await _isExpressMode(db);
    if (isExpress) return; // Express mode: kitchen ticket fires at PAYMENT_COMPLETED

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.order.id));
    await _printKitchenTickets(db, printerService, logger, payload.order.id, items as unknown as OrderItemRow[]);
  });

  eventBus.on("PAYMENT_COMPLETED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:receipt", payload.traceId);
    if (!claimed) return;

    const isExpress = await _isExpressMode(db);

    // Kitchen ticket on PAYMENT_COMPLETED when Express is ON
    if (isExpress) {
      const kitchenClaimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
      if (kitchenClaimed) {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.payment.orderId));
        await _printKitchenTickets(db, printerService, logger, payload.payment.orderId, items as unknown as OrderItemRow[]);
      }
    }

    const jobId = randomUUID();
    logger.info({ jobId, orderId: payload.payment.orderId }, "Queuing receipt print job");

    eventBus.emit("PRINT_JOB_QUEUED", {
      traceId: payload.traceId,
      jobId,
      type: "receipt",
      payload: {
        orderId: payload.payment.orderId,
        amount: payload.payment.amount,
        currency: payload.payment.currency,
        method: payload.payment.method,
        ...(payload.payment.reference !== undefined ? { reference: payload.payment.reference } : {}),
        paidAt: payload.payment.createdAt,
      },
      timestamp: new Date(),
    });
  });

  eventBus.on("PRINT_JOB_QUEUED", async (payload) => {
    if (payload.type !== "receipt") return;

    const activePrinters = await db.select().from(printers).where(eq(printers.active, true));
    const receiptPrinter = activePrinters.find((p) => p.receiptEnabled);
    if (!receiptPrinter) {
      logger.debug({ jobId: payload.jobId }, "No active receipt printer — skipping print");
      return;
    }

    const templates = await db.select().from(receiptTemplates).where(eq(receiptTemplates.active, true));
    const template = templates[0];

    const p = payload.payload as {
      orderId: string;
      amount: number;
      currency: string;
      method: string;
      paidAt: Date;
    };

    // Load order items from DB
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, p.orderId));

    const lines: ReceiptLine[] = [];

    // Header
    if (template?.headerText) {
      lines.push({ type: "header", content: template.headerText });
    } else {
      lines.push({ type: "header", content: "Scontrino" });
    }
    lines.push({ type: "divider" });

    // Order number + timestamp
    if (template?.showOrderNumber ?? true) {
      lines.push({ type: "item", left: "Ordine", right: `#${p.orderId.slice(-6).toUpperCase()}` });
    }
    if (template?.showTimestamp ?? true) {
      lines.push({ type: "item", left: "Data", right: new Date(p.paidAt).toLocaleString("it-IT") });
    }

    lines.push({ type: "divider" });

    // Items
    for (const item of items) {
      lines.push({
        type: "item",
        left: `${item.quantity}x ${item.name}`,
        right: `€${(item.unitPrice * item.quantity).toFixed(2)}`,
      });
    }

    lines.push({ type: "divider" });

    // Total + payment
    lines.push({ type: "total", left: "TOTALE", right: `€${p.amount.toFixed(2)}` });

    if (template?.showPaymentMethod ?? true) {
      lines.push({ type: "item", left: "Pagamento", right: p.method });
    }

    lines.push({ type: "divider" });

    // Footer
    if (template?.footerText) {
      lines.push({ type: "text", content: "" });
      lines.push({ type: "text", content: template.footerText });
    }

    const content = formatReceipt(lines);

    const job = {
      printerId: receiptPrinter.id,
      content,
      type: "receipt" as const,
      ...(receiptPrinter.host && receiptPrinter.port
        ? { printerConfig: { host: receiptPrinter.host, port: receiptPrinter.port } }
        : {}),
    };

    const result = await printerService.printDirect(job);
    logger.info({ result, printerId: receiptPrinter.id }, "Print result");
  });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
