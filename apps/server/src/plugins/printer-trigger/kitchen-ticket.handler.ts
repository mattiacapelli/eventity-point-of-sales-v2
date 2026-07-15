import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { eq, inArray } from "@pos/db";
import { orders, orderItems, orderItemOptions, products, productionCenters, productionCenterCategories, productionCenterPrinters, printers, kitchenTemplates, orderCenterNumbers } from "@pos/db";
import { formatKitchenTicket, renderKitchenImage, pngToEscposRaster } from "@pos/core";
import type { KitchenBlock } from "@pos/shared-types";
import type { DbClient } from "@pos/db";
import type { PrinterService, Logger } from "@pos/core";
import type { EventBus } from "@pos/event-bus";
import type { OrderItemRow, OrderItemOptionRow, PrinterRow } from "./types.js";

export async function printKitchenTickets(
  db: DbClient,
  printerService: PrinterService,
  logger: Logger,
  eventBus: EventBus,
  orderId: number,
  items: OrderItemRow[],
  dataDir: string,
  receiptDisplay?: string,
  centerNumbersMap?: Map<number, number>,
): Promise<void> {
  if (items.length === 0) return;

  const [orderRow] = await db.select({
    tableId:      orders.tableId,
    customerName: orders.customerName,
    notes:        orders.notes,
    pax:          orders.pax,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);

  const tableId      = orderRow?.tableId      ?? null;
  const customerName = orderRow?.customerName ?? null;
  const orderNotes   = orderRow?.notes        ?? null;
  const pax          = orderRow?.pax          ?? null;

  const itemIds    = items.map((i) => i.id);
  const optionRows = itemIds.length > 0
    ? await db.select().from(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds)) as unknown as OrderItemOptionRow[]
    : [];
  const optionsByItemId = new Map<number, OrderItemOptionRow[]>();
  for (const opt of optionRows) {
    const arr = optionsByItemId.get(opt.orderItemId) ?? [];
    arr.push(opt);
    optionsByItemId.set(opt.orderItemId, arr);
  }

  const productIds    = [...new Set(items.map((i) => i.productId))];
  const productCatRows = productIds.length > 0
    ? await db.select({ id: products.id, categoryId: products.categoryId }).from(products).where(inArray(products.id, productIds))
    : [];
  const productCatMap = new Map(productCatRows.map((r) => [r.id, r.categoryId ?? null]));

  const categoryIds = [...new Set(productCatRows.map((r) => r.categoryId).filter((c): c is number => c !== null && c !== undefined))];
  const pcCatRows   = categoryIds.length > 0
    ? await db.select({
        categoryId:        productionCenterCategories.categoryId,
        productionCenterId: productionCenterCategories.productionCenterId,
      }).from(productionCenterCategories).where(inArray(productionCenterCategories.categoryId, categoryIds))
    : [];

  const catToCenters = new Map<number, number[]>();
  for (const r of pcCatRows) {
    const arr = catToCenters.get(r.categoryId) ?? [];
    arr.push(r.productionCenterId);
    catToCenters.set(r.categoryId, arr);
  }

  const centerIds = [...new Set(pcCatRows.map((r) => r.productionCenterId))];
  const centerNameRows = centerIds.length > 0
    ? await db.select({ id: productionCenters.id, name: productionCenters.name }).from(productionCenters).where(inArray(productionCenters.id, centerIds))
    : [];
  const centerNameMap = new Map(centerNameRows.map((r) => [r.id, r.name]));

  // Group items by production center
  const centerItems = new Map<number | "__generale__", { centerName: string; items: OrderItemRow[] }>();
  const unroutedItems: OrderItemRow[] = [];

  for (const item of items) {
    const categoryId     = productCatMap.get(item.productId) ?? null;
    if (categoryId === null) { unroutedItems.push(item); continue; }
    const centerIdsForCat = catToCenters.get(categoryId);
    if (!centerIdsForCat || centerIdsForCat.length === 0) { unroutedItems.push(item); continue; }
    for (const centerId of centerIdsForCat) {
      const existing = centerItems.get(centerId);
      if (existing) {
        existing.items.push(item);
      } else {
        centerItems.set(centerId, { centerName: centerNameMap.get(centerId) ?? "Cucina", items: [item] });
      }
    }
  }
  if (unroutedItems.length > 0) {
    centerItems.set("__generale__", { centerName: "Generale", items: unroutedItems });
  }

  const activePrinters = await db.select().from(printers).where(eq(printers.active, true)) as unknown as PrinterRow[];
  const allKitchenPrinters = activePrinters.filter((p) => p.kitchenEnabled);
  if (allKitchenPrinters.length === 0) {
    logger.debug({ orderId }, "No active kitchen printers — skipping kitchen ticket");
    return;
  }

  const now = new Date();

  for (const [centerId, { centerName, items: centerGroupItems }] of centerItems) {
    const effectiveReceiptDisplay = (centerNumbersMap && typeof centerId === "number" && centerNumbersMap.has(centerId))
      ? String(centerNumbersMap.get(centerId)!)
      : receiptDisplay;
    let targetPrinters: PrinterRow[];
    if (centerId !== "__generale__" && typeof centerId === "number") {
      const dedicatedRows = await db
        .select({ printerId: productionCenterPrinters.printerId })
        .from(productionCenterPrinters)
        .where(eq(productionCenterPrinters.productionCenterId, centerId));
      if (dedicatedRows.length > 0) {
        const dedicatedIds = dedicatedRows.map((r) => r.printerId);
        targetPrinters = allKitchenPrinters.filter((p) => dedicatedIds.includes(p.id));
      } else {
        targetPrinters = allKitchenPrinters;
      }
    } else {
      targetPrinters = allKitchenPrinters;
    }

    const ticketItems = centerGroupItems.map((i) => ({
      name:     i.name,
      quantity: i.quantity,
      options:  (optionsByItemId.get(i.id) ?? []).map((o) => ({ optionName: o.optionName, priceDelta: o.priceDelta })),
      ...(i.notes ? { notes: i.notes } : {}),
    }));

    for (const printer of targetPrinters) {
      if (!printer.host || !printer.port) continue;
      const printerConfig = { host: printer.host, port: printer.port };

      try {
        if (printer.printMode === "image") {
          const templateRows = await db.select().from(kitchenTemplates).where(eq(kitchenTemplates.active, true));
          const numCenterId  = typeof centerId === "number" ? centerId : null;
          const template     = (numCenterId !== null ? templateRows.find((t) => t.productionCenterId === numCenterId) : undefined) ?? templateRows[0];

          if (template?.blocks) {
            let blocks: KitchenBlock[];
            try {
              blocks = (typeof template.blocks === "string" ? JSON.parse(template.blocks) : template.blocks) as KitchenBlock[];
            } catch {
              logger.warn({ printerId: printer.id, orderId }, "Kitchen template blocks JSON invalid — falling back to text mode");
              blocks = [];
            }
            if (blocks.length > 0) {
              const pngBuffer    = await renderKitchenImage({
                blocks,
                canvasWidth:  template.canvasWidth ?? 576,
                logoPath:     template.logoPath ? resolve(join(dataDir, template.logoPath)) : null,
                centerName, orderId, receiptDisplay: effectiveReceiptDisplay, tableId, customerName, orderNotes, pax,
                timestamp: now, items: ticketItems,
              });
              const rasterBuffer = await pngToEscposRaster(pngBuffer, template.canvasWidth ?? 576);
              const result       = await printerService.printDirect({ printerId: printer.id, contentBuffer: rasterBuffer, type: "kitchen", printerConfig });
              if (!result.success) {
                eventBus.emit("PRINTER_OFFLINE", { traceId: randomUUID(), printerId: printer.id, printerName: printer.name, reason: result.message, timestamp: new Date() });
              }
              logger.info({ printerId: printer.id, orderId, centerName, mode: "image" }, "Kitchen ticket printed");
              continue;
            }
          }
        }

        const content = formatKitchenTicket({
          orderId,
          ...(effectiveReceiptDisplay !== undefined ? { receiptDisplay: effectiveReceiptDisplay } : {}),
          ...(tableId      ? { tableId }      : {}),
          ...(customerName ? { customerName } : {}),
          ...(orderNotes   ? { orderNotes }   : {}),
          ...(pax          ? { pax }          : {}),
          centerName, timestamp: now, items: ticketItems,
        });
        const result = await printerService.printDirect({ printerId: printer.id, content, type: "kitchen", printerConfig });
        if (!result.success) {
          eventBus.emit("PRINTER_OFFLINE", { traceId: randomUUID(), printerId: printer.id, printerName: printer.name, reason: result.message, timestamp: new Date() });
        }
        logger.info({ printerId: printer.id, orderId, centerName, mode: "text" }, "Kitchen ticket printed");
      } catch (err) {
        logger.error({ err, printerId: printer.id, orderId, centerName }, "Kitchen ticket print failed");
        eventBus.emit("PRINTER_OFFLINE", { traceId: randomUUID(), printerId: printer.id, printerName: printer.name, reason: err instanceof Error ? err.message : "Print failed", timestamp: new Date() });
      }
    }
  }
}
