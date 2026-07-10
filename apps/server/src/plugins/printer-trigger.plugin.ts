import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, sql, orderItems, orders, shifts, receiptTemplates, terminalPrinters } from "@pos/db";
import { formatReceiptNumber } from "@pos/module-sales";
import type { DbClient } from "@pos/db";

import { loadExpressMode, loadReceiptNumSettings, loadMultiTerminalEnabled, resolveReceiptPrinter, loadReceiptContext } from "./printer-trigger/db-loaders.js";
import { printKitchenTickets } from "./printer-trigger/kitchen-ticket.handler.js";
import { printOneReceipt, groupItemsByCategory, groupItemsByCenter, buildSeparateGroups } from "./printer-trigger/receipt-renderer.js";
import type { ReceiptJobData } from "./printer-trigger/types.js";

const printerTriggerPlugin: FastifyPluginAsync = async (fastify) => {
  const { eventBus, logger, db, printerService } = fastify.ctx;

  // ── PRINTER_OFFLINE → notify only the terminals assigned to that printer ──

  eventBus.on("PRINTER_OFFLINE", async (payload) => {
    const assignedTerminals = await db
      .select({ terminalId: terminalPrinters.terminalId })
      .from(terminalPrinters)
      .where(eq(terminalPrinters.printerId, payload.printerId));
    for (const { terminalId } of assignedTerminals) {
      fastify.wsBroadcaster.sendToTerminal(terminalId, "PRINTER_OFFLINE", payload);
    }
  });

  // ── ORDER_UPDATED → update shift totals when an order is completed ──────

  eventBus.on("ORDER_UPDATED", async (payload) => {
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
  });

  // ── ORDER_CREATED → kitchen ticket (express mode OFF) ───────────────────

  eventBus.on("ORDER_CREATED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
    if (!claimed) return;
    if (await loadExpressMode(db)) return;

    const items      = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.order.id));
    const numSettings = await loadReceiptNumSettings(db);
    const receiptDisplay = formatReceiptNumber(payload.order.receiptNumber, payload.order.id, numSettings.prefix, numSettings.padding);
    await printKitchenTickets(db, printerService, logger, eventBus, payload.order.id, items as never, fastify.ctx.config.dataDir, receiptDisplay);
  });

  // ── PAYMENT_COMPLETED → kitchen ticket (express mode ON) + receipt ───────

  eventBus.on("PAYMENT_COMPLETED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:receipt", payload.traceId);
    if (!claimed) return;

    if (await loadExpressMode(db)) {
      const kitchenClaimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
      if (kitchenClaimed) {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.payment.orderId));
        const [orderRow] = await db.select({ receiptNumber: orders.receiptNumber }).from(orders).where(eq(orders.id, payload.payment.orderId)).limit(1);
        const numSettings    = await loadReceiptNumSettings(db);
        const receiptDisplay = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, payload.payment.orderId, numSettings.prefix, numSettings.padding);
        await printKitchenTickets(db, printerService, logger, eventBus, payload.payment.orderId, items as never, fastify.ctx.config.dataDir, receiptDisplay);
      }
    }

    const jobId = randomUUID();
    logger.info({ jobId, orderId: payload.payment.orderId }, "Queuing receipt print job");

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
  });

  // ── PRINT_JOB_QUEUED → resolve printer + template + print receipt ────────

  eventBus.on("PRINT_JOB_QUEUED", async (payload) => {
    if (payload.type !== "receipt") return;

    const multiTerminalEnabled = await loadMultiTerminalEnabled(db);
    const terminalId = (payload.payload as { terminalId?: string }).terminalId ?? null;
    const printer    = await resolveReceiptPrinter(db, multiTerminalEnabled, terminalId);

    if (!printer) {
      logger.debug({ jobId: payload.jobId }, "No active receipt printer — skipping print");
      return;
    }

    const p: ReceiptJobData = {
      ...(payload.payload as ReceiptJobData),
      paidAt: new Date((payload.payload as { paidAt: Date | string }).paidAt),
    };

    const ctx = await loadReceiptContext(db, p, multiTerminalEnabled, fastify.ctx.config.dataDir);

    const allActiveTemplates = await db.select().from(receiptTemplates).where(eq(receiptTemplates.active, true));
    const masterTemplate = allActiveTemplates.find((t) => t.role === "master") ?? allActiveTemplates[0];
    const subTemplate    = allActiveTemplates.find((t) => t.role === "sub");
    const copyTemplate   = allActiveTemplates.find((t) => t.role === "client_copy");
    const printMethod    = masterTemplate?.printMethod ?? "single";

    const printOpts = { ctx, p, printer, printerService, logger, eventBus, jobId: payload.jobId, printMethod };

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
      // "single" — default
      await printOneReceipt({ ...printOpts, tmpl: masterTemplate, jobItems: ctx.items, jobTotal: p.amount });
    }
  });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
