import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, desc, sql, orderItems, orderCenterNumbers, orders, payments, shifts, receiptTemplates, terminalPrinters, appSettings, logPrint } from "@pos/db";
import { formatReceiptNumber } from "@pos/module-sales";
import type { DbClient } from "@pos/db";

import { loadExpressMode, loadReceiptNumSettings, loadMultiTerminalEnabled, resolveReceiptPrinter, loadReceiptContext } from "./printer-trigger/db-loaders.js";
import { printKitchenTickets } from "./printer-trigger/kitchen-ticket.handler.js";
import { printOneReceipt, groupItemsByCategory, groupItemsByCenter, buildSeparateGroups } from "./printer-trigger/receipt-renderer.js";
import type { ReceiptJobData } from "./printer-trigger/types.js";

const printerTriggerPlugin: FastifyPluginAsync = async (fastify) => {
  const { eventBus, logger, db, printerService } = fastify.ctx;

  // ── PRINTER_OFFLINE → notify only the terminals assigned to that printer ──

  // All event handlers use fire-and-forget (void async IIFE) so the event bus
  // is never blocked waiting for I/O — print jobs, DB queries, or TCP timeouts
  // cannot stall unrelated order processing.

  eventBus.on("PRINTER_OFFLINE", (payload) => { void (async () => {
    const assignedTerminals = await db
      .select({ terminalId: terminalPrinters.terminalId })
      .from(terminalPrinters)
      .where(eq(terminalPrinters.printerId, payload.printerId));
    for (const { terminalId } of assignedTerminals) {
      fastify.wsBroadcaster.sendToTerminal(terminalId, "PRINTER_OFFLINE", payload);
    }
  })(); });

  // ── ORDER_UPDATED → update shift totals when an order is completed ──────

  eventBus.on("ORDER_UPDATED", (payload) => { void (async () => {
    if (payload.order.status !== "completed") return;
    const claimed = await claimEvent(db, "shift-totals:order-completed", payload.traceId);
    if (!claimed) return;

    const [orderRow] = await db
      .select({ shiftId: orders.shiftId, totalAmount: orders.totalAmount })
      .from(orders)
      .where(eq(orders.id, payload.order.id))
      .limit(1);

    if (!orderRow?.shiftId) return;

    await db.update(shifts)
      .set({
        totalSales:  sql`total_sales + ${orderRow.totalAmount}`,
        totalOrders: sql`total_orders + 1`,
      })
      .where(eq(shifts.id, orderRow.shiftId));
  })(); });

  // ── ORDER_UPDATED (itemsChanged) → reprint kitchen + receipt ─────────────

  eventBus.on("ORDER_UPDATED", (payload) => { void (async () => {
    if (!payload.itemsChanged) return;
    const claimed = await claimEvent(db, "printer-trigger:items-changed", payload.traceId);
    if (!claimed) return;

    const orderId = payload.order.id;
    const items   = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const numSettings = await loadReceiptNumSettings(db);
    const [modeRow] = await db.select().from(appSettings).where(eq(appSettings.key, "receipt_number_mode")).limit(1);
    const mode = modeRow?.value ?? "shift";

    let receiptDisplay: string | undefined;
    let centerNumbersMap: Map<number, number> | undefined;
    if (mode === "center") {
      const cnRows = await db.select().from(orderCenterNumbers).where(eq(orderCenterNumbers.orderId, orderId));
      centerNumbersMap = new Map(cnRows.map((r) => [r.productionCenterId, r.centerNumber]));
    } else {
      receiptDisplay = formatReceiptNumber(payload.order.receiptNumber, orderId, numSettings.prefix, numSettings.padding);
    }

    try {
      await printKitchenTickets(db, printerService, logger, eventBus, orderId, items as never, fastify.ctx.config.dataDir, receiptDisplay, centerNumbersMap, true);
    } catch (err) {
      logger.error({ err, orderId }, "Kitchen ticket reprint failed — receipt reprint will still proceed");
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (payment) {
      const jobId = randomUUID();
      logger.info({ jobId, orderId }, "Queuing receipt reprint after items changed");
      eventBus.emit("PRINT_JOB_QUEUED", {
        traceId: payload.traceId,
        jobId,
        type: "receipt",
        payload: {
          orderId:  payment.orderId,
          amount:   payment.amount,
          currency: payment.currency,
          method:   payment.method,
          paidAt:   payment.createdAt,
        },
        timestamp: new Date(),
      });
    }
  })(); });

  // ── ORDER_CREATED → kitchen ticket (express mode OFF) ───────────────────

  eventBus.on("ORDER_CREATED", (payload) => { void (async () => {
    const claimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
    if (!claimed) return;
    if (await loadExpressMode(db)) return;

    const items      = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.order.id));
    const numSettings = await loadReceiptNumSettings(db);
    const [modeRow] = await db.select().from(appSettings).where(eq(appSettings.key, "receipt_number_mode")).limit(1);
    const mode = modeRow?.value ?? "shift";
    let receiptDisplay: string | undefined;
    let centerNumbersMap: Map<number, number> | undefined;
    if (mode === "center") {
      const cnRows = await db.select().from(orderCenterNumbers).where(eq(orderCenterNumbers.orderId, payload.order.id));
      centerNumbersMap = new Map(cnRows.map((r) => [r.productionCenterId, r.centerNumber]));
    } else {
      receiptDisplay = formatReceiptNumber(payload.order.receiptNumber, payload.order.id, numSettings.prefix, numSettings.padding);
    }
    try {
      await printKitchenTickets(db, printerService, logger, eventBus, payload.order.id, items as never, fastify.ctx.config.dataDir, receiptDisplay, centerNumbersMap, false, payload.order.terminalId, payload.clientIp);
    } catch (err) {
      logger.error({ err, orderId: payload.order.id }, "Kitchen ticket failed on ORDER_CREATED");
    }
  })(); });

  // ── PAYMENT_COMPLETED → kitchen ticket (express mode ON) + receipt ───────

  eventBus.on("PAYMENT_COMPLETED", (payload) => { void (async () => {
    const claimed = await claimEvent(db, "printer-trigger:receipt", payload.traceId);
    if (!claimed) return;

    if (await loadExpressMode(db)) {
      const kitchenClaimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
      if (kitchenClaimed) {
        try {
          const items = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.payment.orderId));
          const [orderRow] = await db.select({ receiptNumber: orders.receiptNumber }).from(orders).where(eq(orders.id, payload.payment.orderId)).limit(1);
          const numSettings = await loadReceiptNumSettings(db);
          const [modeRow] = await db.select().from(appSettings).where(eq(appSettings.key, "receipt_number_mode")).limit(1);
          const mode = modeRow?.value ?? "shift";
          let receiptDisplay: string | undefined;
          let centerNumbersMap: Map<number, number> | undefined;
          if (mode === "center") {
            const cnRows = await db.select().from(orderCenterNumbers).where(eq(orderCenterNumbers.orderId, payload.payment.orderId));
            centerNumbersMap = new Map(cnRows.map((r) => [r.productionCenterId, r.centerNumber]));
          } else {
            receiptDisplay = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, payload.payment.orderId, numSettings.prefix, numSettings.padding);
          }
          await printKitchenTickets(db, printerService, logger, eventBus, payload.payment.orderId, items as never, fastify.ctx.config.dataDir, receiptDisplay, centerNumbersMap);
        } catch (err) {
          logger.error({ err, orderId: payload.payment.orderId }, "Kitchen ticket failed in express mode — receipt will still print");
        }
      }
    }

    const jobId = randomUUID();
    logger.info({ jobId, orderId: payload.payment.orderId }, "Queuing receipt print job");
    logPrint(db, { orderId: payload.payment.orderId, jobType: "receipt", event: "queued", terminalId: payload.terminalId });

    eventBus.emit("PRINT_JOB_QUEUED", {
      traceId: payload.traceId,
      jobId,
      type: "receipt",
      payload: {
        orderId:   payload.payment.orderId,
        amount:    payload.payment.amount,
        currency:  payload.payment.currency,
        method:    payload.payment.method,
        paidAt:    payload.payment.createdAt,
        ...(payload.payment.reference !== undefined ? { reference: payload.payment.reference } : {}),
        ...(payload.terminalId !== undefined        ? { terminalId: payload.terminalId }        : {}),
      },
      timestamp: new Date(),
    });
  })(); });

  // ── PRINT_JOB_QUEUED → resolve printer + template + print receipt ────────

  eventBus.on("PRINT_JOB_QUEUED", (payload) => { void (async () => {
    if (payload.type !== "receipt") return;
    const claimed = await claimEvent(db, "printer-trigger:print-job", payload.jobId);
    if (!claimed) return;

    const multiTerminalEnabled = await loadMultiTerminalEnabled(db);
    const rawTerminalId = (payload.payload as { terminalId?: number | string }).terminalId;
    const terminalId: number | null = rawTerminalId !== undefined
      ? (typeof rawTerminalId === "string" ? parseInt(rawTerminalId, 10) : rawTerminalId)
      : null;
    const printer = await resolveReceiptPrinter(db, multiTerminalEnabled, terminalId);

    if (!printer) {
      logger.debug({ jobId: payload.jobId }, "No active receipt printer — skipping print");
      return;
    }

    const rawPayload = payload.payload as { orderId: number | string; amount: number; currency: string; method: string; paidAt: Date | string; terminalId?: number | string };
    const p: ReceiptJobData = {
      orderId: typeof rawPayload.orderId === "string" ? parseInt(rawPayload.orderId, 10) : rawPayload.orderId,
      amount: rawPayload.amount,
      currency: rawPayload.currency,
      method: rawPayload.method,
      paidAt: new Date(rawPayload.paidAt),
      ...(rawPayload.terminalId !== undefined ? {
        terminalId: typeof rawPayload.terminalId === "string" ? parseInt(rawPayload.terminalId, 10) : rawPayload.terminalId,
      } : {}),
    };

    const ctx = await loadReceiptContext(db, p, multiTerminalEnabled, fastify.ctx.config.dataDir);

    const allActiveTemplates = await db.select().from(receiptTemplates).where(eq(receiptTemplates.active, true));
    const masterTemplate = allActiveTemplates.find((t) => t.role === "master") ?? allActiveTemplates[0];
    const subTemplate    = allActiveTemplates.find((t) => t.role === "sub");
    const copyTemplate   = allActiveTemplates.find((t) => t.role === "client_copy");
    const printMethod    = masterTemplate?.printMethod ?? "single";

    const printOpts = { ctx, p, printer, printerService, logger, eventBus, db, jobId: payload.jobId, printMethod, ...(terminalId !== null ? { terminalId } : {}) };

    const separateGroups = buildSeparateGroups(ctx.items, ctx);

    if (separateGroups.size > 0) {
      for (const { name, items } of separateGroups.values()) {
        try {
          const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt({ ...printOpts, tmpl: subTemplate ?? masterTemplate, jobItems: items, jobTotal: total, groupName: name });
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Separate slip print failed — continuing");
        }
      }
      try {
        await printOneReceipt({ ...printOpts, tmpl: copyTemplate ?? masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
      } catch (err) {
        logger.error({ err, jobId: payload.jobId }, "Client copy print failed");
      }
      return;
    }

    if (printMethod === "by_category" || printMethod === "by_category_copy") {
      const grouped = groupItemsByCategory(ctx.items, ctx);
      for (const { name, items } of grouped.values()) {
        try {
          const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt({ ...printOpts, tmpl: subTemplate ?? masterTemplate, jobItems: items, jobTotal: total, groupName: name });
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Category slip print failed — continuing");
        }
      }
      if (printMethod === "by_category_copy") {
        await printOneReceipt({ ...printOpts, tmpl: copyTemplate ?? masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
      }

    } else if (printMethod === "by_center" || printMethod === "by_center_copy") {
      const grouped = groupItemsByCenter(ctx.items, ctx);
      for (const { name, items } of grouped.values()) {
        try {
          const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt({ ...printOpts, tmpl: subTemplate ?? masterTemplate, jobItems: items, jobTotal: total, groupName: name });
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Center slip print failed — continuing");
        }
      }
      if (printMethod === "by_center_copy") {
        await printOneReceipt({ ...printOpts, tmpl: copyTemplate ?? masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
      }

    } else if (printMethod === "per_item" || printMethod === "per_item_copy") {
      for (const item of ctx.items) {
        try {
          await printOneReceipt({ ...printOpts, tmpl: subTemplate ?? masterTemplate, jobItems: [item], jobTotal: item.unitPrice * item.quantity });
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, itemName: item.name }, "Per-item slip print failed — continuing");
        }
      }
      if (printMethod === "per_item_copy") {
        await printOneReceipt({ ...printOpts, tmpl: copyTemplate ?? masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
      }

    } else {
      await printOneReceipt({ ...printOpts, tmpl: masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
    }
  })(); });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
