import { randomUUID } from "node:crypto";
import { formatReceipt, renderReceiptImage, pngToEscposRaster } from "@pos/core";
import { computeVatBreakdown } from "@pos/module-sales";
import type { ReceiptBlock } from "@pos/shared-types";
import type { PrinterService, Logger } from "@pos/core";
import type { EventBus } from "@pos/event-bus";
import type { OrderItemRow, PrinterRow, ReceiptContext, ReceiptJobData } from "./types.js";
import type { ReceiptLine } from "@pos/core";

type TemplateRow = {
  id: number;
  role: string | null;
  printMode: string | null;
  blocks: string | unknown | null;
  canvasWidth: number | null;
  headerText: string | null;
  footerText: string | null;
  showOrderNumber: boolean | null;
  showTimestamp: boolean | null;
  showPaymentMethod: boolean | null;
  showItemCategory: boolean | null;
  printMethod: string | null;
};

export function buildTextLines(
  tmpl: TemplateRow | undefined,
  jobItems: OrderItemRow[],
  jobTotal: number,
  ctx: ReceiptContext,
  p: ReceiptJobData,
  groupName?: string,
): ReceiptLine[] {
  const { displayNum, paymentMethodName, orderTerminalName, orderRow, restaurant, productCategoryMap, categoryNameMap } = ctx;
  const lines: ReceiptLine[] = [];

  if (groupName) {
    lines.push({ type: "header", content: groupName });
    lines.push({ type: "divider" });
  } else {
    if (restaurant.name) {
      lines.push({ type: "header", content: restaurant.name });
      const addressLine = [restaurant.address, restaurant.city].filter(Boolean).join(", ");
      if (addressLine) lines.push({ type: "text", content: addressLine });
      if (restaurant.phone) lines.push({ type: "text", content: `Tel: ${restaurant.phone}` });
      if (restaurant.vat)   lines.push({ type: "text", content: `P.IVA ${restaurant.vat}` });
    } else if (tmpl?.headerText) {
      lines.push({ type: "header", content: tmpl.headerText });
    } else {
      lines.push({ type: "header", content: "Scontrino" });
    }
    lines.push({ type: "divider" });
    if (tmpl?.showOrderNumber ?? true) lines.push({ type: "item", left: "Ordine", right: `#${displayNum}` });
    if (tmpl?.showTimestamp   ?? true) lines.push({ type: "item", left: "Data",   right: new Date(p.paidAt).toLocaleString("it-IT") });
    if (orderTerminalName)              lines.push({ type: "item", left: "Cassa",  right: orderTerminalName });
    if (orderRow?.tableId)              lines.push({ type: "item", left: "Tavolo", right: orderRow.tableId });
    if (orderRow?.customerName)         lines.push({ type: "item", left: "Cliente", right: orderRow.customerName });
    lines.push({ type: "divider" });
  }

  for (const item of jobItems) {
    lines.push({ type: "item", left: `${item.quantity}x ${item.name}`, right: `€${(item.unitPrice * item.quantity).toFixed(2)}` });
    if (tmpl?.showItemCategory) {
      const catId   = productCategoryMap[item.productId] ?? null;
      const catName = catId !== null ? categoryNameMap[catId] : undefined;
      if (catName) lines.push({ type: "text", content: `  ${catName}` });
    }
  }

  lines.push({ type: "divider" });
  lines.push({ type: "total", left: "TOTALE", right: `€${jobTotal.toFixed(2)}` });
  if (!groupName && (tmpl?.showPaymentMethod ?? true)) lines.push({ type: "item", left: "Pagamento", right: paymentMethodName });

  if (!groupName) {
    const vatItems: Array<{ id: number; productId: number; name: string; quantity: number; unitPrice: number; vatRate: number }> = jobItems.map((i) => ({
      id: i.id, productId: i.productId, name: i.name,
      quantity: i.quantity, unitPrice: i.unitPrice,
      vatRate: i.vatRate ?? 10,
    }));
    const vatBreakdown = computeVatBreakdown(vatItems, orderRow?.discountAmount ?? 0, jobTotal);
    if (vatBreakdown.length > 0) {
      lines.push({ type: "divider" });
      for (const vb of vatBreakdown) {
        lines.push({ type: "item", left: `IVA ${vb.rate}%`,   right: `€${vb.tax.toFixed(2)}` });
        lines.push({ type: "item", left: `  Imponibile`,       right: `€${vb.taxable.toFixed(2)}` });
      }
    }

    if (orderRow?.fiscalDocNumber) {
      lines.push({ type: "divider" });
      lines.push({ type: "text", content: `Doc. Comm. n. ${orderRow.fiscalDocNumber}` });
      if (orderRow.fiscalDocDate)   lines.push({ type: "text", content: orderRow.fiscalDocDate });
      if (orderRow.fiscalRtSerial)  lines.push({ type: "text", content: `RT: ${orderRow.fiscalRtSerial}` });
    }
  }

  lines.push({ type: "divider" });
  if (!groupName && tmpl?.footerText) {
    lines.push({ type: "text", content: "" });
    lines.push({ type: "text", content: tmpl.footerText });
  }
  return lines;
}

export async function printOneReceipt(opts: {
  tmpl: TemplateRow | undefined;
  jobItems: OrderItemRow[];
  jobTotal: number;
  ctx: ReceiptContext;
  p: ReceiptJobData;
  printer: PrinterRow;
  printerService: PrinterService;
  logger: Logger;
  eventBus: EventBus;
  jobId: string;
  printMethod: string;
  groupName?: string;
}): Promise<void> {
  const { tmpl, jobItems, jobTotal, ctx, p, printer, printerService, logger, eventBus, jobId, printMethod, groupName } = opts;
  const printerConfig = printer.host && printer.port ? { host: printer.host, port: printer.port } : undefined;
  const isSub = groupName !== undefined;

  const emitOffline = (reason: string) => {
    eventBus.emit("PRINTER_OFFLINE", {
      traceId:     randomUUID(),
      printerId:   printer.id,
      printerName: printer.name,
      reason,
      timestamp:   new Date(),
    });
  };

  try {
    const useImageMode = tmpl?.printMode === "image" && !!tmpl?.blocks;

    if (useImageMode) {
      let blocks: ReceiptBlock[];
      try {
        blocks = (typeof tmpl!.blocks === "string" ? JSON.parse(tmpl!.blocks as string) : tmpl!.blocks) as ReceiptBlock[];
      } catch {
        logger.warn({ jobId }, "Receipt template blocks JSON invalid — falling back to text mode");
        await printOneReceipt({ ...opts, tmpl: { ...tmpl!, printMode: "text" } });
        return;
      }

      const pngBuffer = await renderReceiptImage({
        blocks,
        canvasWidth:       tmpl!.canvasWidth ?? 576,
        logoPath:          ctx.resolvedLogoPath,
        orderId:           p.orderId,
        receiptDisplay:    ctx.displayNum,
        items:             jobItems.map((i) => {
          const catId   = ctx.productCategoryMap[i.productId] ?? null;
          const catName = catId !== null ? ctx.categoryNameMap[catId] : undefined;
          return { name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, ...(catName ? { category: catName } : {}) };
        }),
        showItemCategory:  tmpl?.showItemCategory ?? false,
        total:             jobTotal,
        paymentMethod:     ctx.paymentMethodName,
        currency:          p.currency,
        paidAt:            new Date(p.paidAt),
        restaurantName:    ctx.restaurant.name,
        restaurantAddress: ctx.restaurant.address,
        restaurantCity:    ctx.restaurant.city,
        restaurantVat:     ctx.restaurant.vat,
        restaurantPhone:   ctx.restaurant.phone,
        ...(isSub ? { categoryName: groupName } : {}),
        ...(ctx.orderTerminalName ? { terminalName: ctx.orderTerminalName } : {}),
        ...(ctx.orderRow?.tableId    ? { tableId:      ctx.orderRow.tableId }    : {}),
        ...(ctx.orderRow?.customerName ? { customerName: ctx.orderRow.customerName } : {}),
      });

      const rasterBuffer = await pngToEscposRaster(pngBuffer, tmpl!.canvasWidth ?? 576);
      const result = await printerService.printDirect({
        printerId: printer.id,
        contentBuffer: rasterBuffer,
        type: "receipt",
        ...(printerConfig ? { printerConfig } : {}),
      });
      logger.info({ result, printerId: printer.id, mode: "image", printMethod, isSub }, "Print result");
      if (!result.success) emitOffline(result.message);
    } else {
      const lines   = buildTextLines(tmpl, jobItems, jobTotal, ctx, p, groupName);
      const content = formatReceipt(lines);
      const result  = await printerService.printDirect({
        printerId: printer.id,
        content,
        type: "receipt",
        ...(printerConfig ? { printerConfig } : {}),
      });
      logger.info({ result, printerId: printer.id, mode: "text", printMethod, isSub }, "Print result");
      if (!result.success) emitOffline(result.message);
    }
  } catch (err) {
    emitOffline(err instanceof Error ? err.message : "Print failed");
    throw err;
  }
}

export function groupItemsByCategory(
  items: OrderItemRow[],
  ctx: ReceiptContext,
): Map<string, { name: string; items: OrderItemRow[] }> {
  const grouped = new Map<string, { name: string; items: OrderItemRow[] }>();
  for (const item of items) {
    const catId   = ctx.productCategoryMap[item.productId] ?? null;
    const catKey  = catId !== null ? String(catId) : "__none__";
    const catName = catId !== null ? (ctx.categoryNameMap[catId] ?? "Senza categoria") : "Senza categoria";
    const existing = grouped.get(catKey) ?? { name: catName, items: [] };
    existing.items.push(item);
    grouped.set(catKey, existing);
  }
  return grouped;
}

export function groupItemsByCenter(
  items: OrderItemRow[],
  ctx: ReceiptContext,
): Map<string, { name: string; items: OrderItemRow[] }> {
  const grouped = new Map<string, { name: string; items: OrderItemRow[] }>();
  for (const item of items) {
    const catId     = ctx.productCategoryMap[item.productId] ?? null;
    const centerId  = (catId !== null && ctx.categoryFirstCenterMap[catId] !== undefined) ? ctx.categoryFirstCenterMap[catId]! : null;
    const centerKey = centerId !== null ? String(centerId) : "__none__";
    const centerName = centerId !== null ? (ctx.centerNameMap[centerId] ?? "Senza centro") : "Senza centro";
    const existing = grouped.get(centerKey) ?? { name: centerName, items: [] };
    existing.items.push(item);
    grouped.set(centerKey, existing);
  }
  return grouped;
}

export function buildSeparateGroups(
  items: OrderItemRow[],
  ctx: ReceiptContext,
): Map<string, { name: string; items: OrderItemRow[] }> {
  const separateGroups = new Map<string, { name: string; items: OrderItemRow[] }>();
  for (const item of items) {
    const productMode = ctx.productPrintModeMap[item.productId] ?? "inherit";
    if (productMode === "included") continue;

    if (productMode === "separate") {
      const key      = `product:${item.productId}`;
      const existing = separateGroups.get(key) ?? { name: item.name, items: [] };
      existing.items.push(item);
      separateGroups.set(key, existing);
      continue;
    }

    // "inherit" — check production center mode
    const catId     = ctx.productCategoryMap[item.productId] ?? null;
    const centerIds = catId !== null ? (ctx.categoryCentersMap[catId] ?? []) : [];
    const separateCenterId = centerIds.find((cid) => ctx.centerPrintModeMap[cid] === "separate");
    if (separateCenterId !== undefined) {
      const centerKey  = String(separateCenterId);
      const centerName = ctx.centerNameMap[separateCenterId] ?? "Centro";
      const existing   = separateGroups.get(centerKey) ?? { name: centerName, items: [] };
      existing.items.push(item);
      separateGroups.set(centerKey, existing);
    }
  }
  return separateGroups;
}
