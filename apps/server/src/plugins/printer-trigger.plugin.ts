import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, printers } from "@pos/db";
import { formatReceipt, type ReceiptLine } from "@pos/core";

const printerTriggerPlugin: FastifyPluginAsync = async (fastify) => {
  const { eventBus, logger, db, printerService } = fastify.ctx;

  eventBus.on("PAYMENT_COMPLETED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:receipt", payload.traceId);
    if (!claimed) {
      logger.debug({ traceId: payload.traceId }, "Receipt print job already queued — skipping duplicate");
      return;
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

    // Load active receipt printer from DB
    const activePrinters = await db.select().from(printers).where(eq(printers.active, true));
    const receiptPrinter = activePrinters.find((p) => p.receiptEnabled);

    if (!receiptPrinter) {
      logger.debug({ jobId: payload.jobId }, "No active receipt printer configured — skipping print");
      return;
    }

    const p = payload.payload as {
      orderId: string;
      amount: number;
      currency: string;
      method: string;
      paidAt: Date;
    };

    const lines: ReceiptLine[] = [
      { type: "header", content: "Scontrino" },
      { type: "divider" },
      { type: "item", left: `Ordine`, right: `#${p.orderId.slice(-6).toUpperCase()}` },
      { type: "item", left: "Data", right: new Date(p.paidAt).toLocaleString("it-IT") },
      { type: "divider" },
      { type: "total", left: "Totale", right: `${p.currency ?? "EUR"} ${p.amount.toFixed(2)}` },
      { type: "item", left: "Pagamento", right: p.method },
      { type: "divider" },
      { type: "text", content: "" },
      { type: "text", content: "Grazie!" },
    ];

    const content = formatReceipt(lines);

    printerService.enqueue({
      printerId: receiptPrinter.id,
      content,
      type: "receipt",
      ...(receiptPrinter.host && receiptPrinter.port
        ? { printerConfig: { host: receiptPrinter.host, port: receiptPrinter.port } }
        : {}),
    });
  });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
