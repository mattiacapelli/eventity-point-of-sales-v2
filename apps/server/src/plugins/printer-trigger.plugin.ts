import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, sql, inArray, shifts, printers, receiptTemplates, orders, orderItems, orderItemOptions, products, categories, productionCenters, productionCenterCategories, productionCenterPrinters, kitchenTemplates, appSettings } from "@pos/db";
import { formatReceipt, formatKitchenTicket, renderReceiptImage, renderKitchenImage, pngToEscposRaster, type ReceiptLine } from "@pos/core";
import { formatReceiptNumber } from "@pos/module-sales";
import type { ReceiptBlock, KitchenBlock } from "@pos/shared-types";
import type { DbClient } from "@pos/db";
import type { PrinterService, Logger } from "@pos/core";

async function _loadReceiptNumSettings(db: DbClient): Promise<{ prefix: string; padding: number }> {
  const keys = ["receipt_number_prefix", "receipt_number_padding"];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    prefix: m["receipt_number_prefix"] ?? "",
    padding: parseInt(m["receipt_number_padding"] ?? "0", 10),
  };
}

type OrderItemRow = {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  unitPrice: number;
  notes: string | null;
};
type OrderItemOptionRow = { orderItemId: string; optionId: string; optionName: string; priceDelta: number };
type PrinterRow = { id: string; host: string | null; port: number | null; kitchenEnabled: boolean; receiptEnabled: boolean; active: boolean; name: string; printMode: string };

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
  receiptDisplay?: string,
  dataDir = "/data",
): Promise<void> {
  if (items.length === 0) return;

  // Load tableId for this order
  const [orderRow] = await db.select({ tableId: orders.tableId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const tableId = orderRow?.tableId ?? null;

  // Load all options for these order items
  const itemIds = items.map((i) => i.id);
  const optionRows = itemIds.length > 0
    ? await db.select().from(orderItemOptions).where(inArray(orderItemOptions.orderItemId, itemIds)) as unknown as OrderItemOptionRow[]
    : [];
  const optionsByItemId = new Map<string, OrderItemOptionRow[]>();
  for (const opt of optionRows) {
    const arr = optionsByItemId.get(opt.orderItemId) ?? [];
    arr.push(opt);
    optionsByItemId.set(opt.orderItemId, arr);
  }

  // Group items by production center
  const centerItems: Map<string, { centerName: string; items: OrderItemRow[] }> = new Map();
  const unroutedItems: OrderItemRow[] = [];

  for (const item of items) {
    const [productRow] = await db.select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (!productRow?.categoryId) {
      unroutedItems.push(item);
      continue;
    }

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

  if (unroutedItems.length > 0) {
    centerItems.set("__generale__", { centerName: "Generale", items: unroutedItems });
  }

  // Get all active kitchen printers (fallback pool)
  const activePrinters = await db.select().from(printers).where(eq(printers.active, true)) as unknown as PrinterRow[];
  const allKitchenPrinters = activePrinters.filter((p) => p.kitchenEnabled);
  if (allKitchenPrinters.length === 0) {
    logger.debug({ orderId }, "No active kitchen printers — skipping kitchen ticket");
    return;
  }

  const now = new Date();

  for (const [centerId, { centerName, items: centerGroupItems }] of centerItems) {
    // Resolve which printers handle this center (dedicated → fallback to all kitchen)
    let targetPrinters: PrinterRow[];
    if (centerId !== "__generale__") {
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
      name: i.name,
      quantity: i.quantity,
      options: (optionsByItemId.get(i.id) ?? []).map((o) => ({ optionName: o.optionName, priceDelta: o.priceDelta })),
      ...(i.notes ? { notes: i.notes } : {}),
    }));

    for (const printer of targetPrinters) {
      if (!printer.host || !printer.port) continue;
      const printerConfig = { host: printer.host, port: printer.port };

      try {
        if (printer.printMode === "image") {
          // Find kitchen template for this center or a generic active one
          const templateRows = await db.select().from(kitchenTemplates).where(eq(kitchenTemplates.active, true));
          const template = templateRows.find((t) => t.productionCenterId === centerId) ?? templateRows[0];

          if (template?.blocks) {
            const blocks = typeof template.blocks === "string" ? JSON.parse(template.blocks) : template.blocks;
            const pngBuffer = await renderKitchenImage({
              blocks: blocks as KitchenBlock[],
              canvasWidth: template.canvasWidth ?? 576,
              logoPath: template.logoPath ? resolve(join(dataDir, template.logoPath)) : null,
              centerName,
              orderId,
              receiptDisplay,
              tableId,
              timestamp: now,
              items: ticketItems,
            });
            const rasterBuffer = await pngToEscposRaster(pngBuffer, template.canvasWidth ?? 576);
            await printerService.printDirect({
              printerId: printer.id,
              contentBuffer: rasterBuffer,
              type: "kitchen",
              printerConfig,
            });
            logger.info({ printerId: printer.id, orderId, centerName, mode: "image" }, "Kitchen ticket printed");
            continue;
          }
          // Fall through to text if no template
        }

        const content = formatKitchenTicket({
          orderId,
          ...(receiptDisplay !== undefined ? { receiptDisplay } : {}),
          ...(tableId ? { tableId } : {}),
          centerName,
          timestamp: now,
          items: ticketItems,
        });
        await printerService.printDirect({
          printerId: printer.id,
          content,
          type: "kitchen",
          printerConfig,
        });
        logger.info({ printerId: printer.id, orderId, centerName, mode: "text" }, "Kitchen ticket printed");
      } catch (err) {
        logger.error({ err, printerId: printer.id, orderId, centerName }, "Kitchen ticket print failed");
      }
    }
  }
}

const printerTriggerPlugin: FastifyPluginAsync = async (fastify) => {
  const { eventBus, logger, db, printerService } = fastify.ctx;

  // Update shift totals when an order is completed
  eventBus.on("ORDER_UPDATED", async (payload) => {
    if (payload.order.status !== "completed") return;
    const claimed = await claimEvent(db, "shift-totals:order-completed", payload.traceId);
    if (!claimed) return;

    const [orderRow] = await db.select({ shiftId: orders.shiftId, totalAmount: orders.totalAmount })
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

  // Kitchen ticket on ORDER_CREATED (Express OFF)
  eventBus.on("ORDER_CREATED", async (payload) => {
    const claimed = await claimEvent(db, "printer-trigger:kitchen", payload.traceId);
    if (!claimed) return;

    const isExpress = await _isExpressMode(db);
    if (isExpress) return; // Express mode: kitchen ticket fires at PAYMENT_COMPLETED

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, payload.order.id));
    const numSettings = await _loadReceiptNumSettings(db);
    const receiptDisplay = formatReceiptNumber(payload.order.receiptNumber, payload.order.id, numSettings.prefix, numSettings.padding);
    await _printKitchenTickets(db, printerService, logger, payload.order.id, items as unknown as OrderItemRow[], receiptDisplay, fastify.ctx.config.dataDir);
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
        const [orderRow] = await db.select({ receiptNumber: orders.receiptNumber }).from(orders).where(eq(orders.id, payload.payment.orderId)).limit(1);
        const numSettings = await _loadReceiptNumSettings(db);
        const receiptDisplay = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, payload.payment.orderId, numSettings.prefix, numSettings.padding);
        await _printKitchenTickets(db, printerService, logger, payload.payment.orderId, items as unknown as OrderItemRow[], receiptDisplay, fastify.ctx.config.dataDir);
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
    const receiptPrinterFound = activePrinters.find((p) => p.receiptEnabled);
    if (!receiptPrinterFound) {
      logger.debug({ jobId: payload.jobId }, "No active receipt printer — skipping print");
      return;
    }
    const receiptPrinter = receiptPrinterFound;

    // Load all active templates and resolve by role
    const allActiveTemplates = await db.select().from(receiptTemplates).where(eq(receiptTemplates.active, true));
    const masterTemplate = allActiveTemplates.find((t) => t.role === "master") ?? allActiveTemplates[0];
    const subTemplate = allActiveTemplates.find((t) => t.role === "sub");
    const copyTemplate = allActiveTemplates.find((t) => t.role === "client_copy");
    const printMethod = masterTemplate?.printMethod ?? "single";

    const p = payload.payload as {
      orderId: string;
      amount: number;
      currency: string;
      method: string;
      paidAt: Date;
    };

    // Load order items from DB
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, p.orderId));

    // Load restaurant info + receipt number settings + logo
    const settingKeys = ["restaurant_name", "restaurant_address", "restaurant_city", "restaurant_vat", "restaurant_phone", "receipt_number_prefix", "receipt_number_padding", "restaurant_logo_path"];
    const restaurantRows = await db.select().from(appSettings).where(inArray(appSettings.key, settingKeys));
    const rMap = Object.fromEntries(restaurantRows.map((r) => [r.key, r.value]));

    // Load order receipt number
    const [orderRow] = await db.select({ receiptNumber: orders.receiptNumber }).from(orders).where(eq(orders.id, p.orderId)).limit(1);
    const numPrefix = rMap["receipt_number_prefix"] ?? "";
    const numPadding = parseInt(rMap["receipt_number_padding"] ?? "0", 10);
    const displayNum = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, p.orderId, numPrefix, numPadding);

    // Resolve logo path
    const rawLogoPath = rMap["restaurant_logo_path"];
    const absLogoPath = rawLogoPath ? resolve(join(fastify.ctx.config.dataDir, rawLogoPath)) : null;
    const resolvedLogoPath = (absLogoPath && existsSync(absLogoPath)) ? absLogoPath : null;

    const printerConfig = receiptPrinter.host && receiptPrinter.port
      ? { host: receiptPrinter.host, port: receiptPrinter.port }
      : undefined;

    // Lookup product→category mapping (needed for non-single methods)
    let productCategoryMap: Record<string, string | null> = {};
    let categoryNameMap: Record<string, string> = {};
    if (printMethod !== "single" && items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const productRows = await db
        .select({ id: products.id, categoryId: products.categoryId })
        .from(products)
        .where(inArray(products.id, productIds));
      productCategoryMap = Object.fromEntries(productRows.map((pr) => [pr.id, pr.categoryId ?? null]));
      const categoryIds = [...new Set(productRows.map((pr) => pr.categoryId).filter(Boolean))] as string[];
      if (categoryIds.length > 0) {
        const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds));
        categoryNameMap = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));
      }
    }

    // Helper: build text-mode lines for a set of items with optional category header
    function buildTextLines(
      tmpl: typeof masterTemplate,
      jobItems: typeof items,
      jobTotal: number,
      categoryName?: string,
    ): ReceiptLine[] {
      const lines: ReceiptLine[] = [];
      if (categoryName) {
        lines.push({ type: "header", content: categoryName });
        lines.push({ type: "divider" });
      } else {
        const restaurantName = rMap["restaurant_name"] ?? "";
        if (restaurantName) {
          lines.push({ type: "header", content: restaurantName });
          const addressLine = [rMap["restaurant_address"], rMap["restaurant_city"]].filter(Boolean).join(", ");
          if (addressLine) lines.push({ type: "text", content: addressLine });
          if (rMap["restaurant_phone"]) lines.push({ type: "text", content: `Tel: ${rMap["restaurant_phone"]}` });
          if (rMap["restaurant_vat"]) lines.push({ type: "text", content: `P.IVA ${rMap["restaurant_vat"]}` });
        } else if (tmpl?.headerText) {
          lines.push({ type: "header", content: tmpl.headerText });
        } else {
          lines.push({ type: "header", content: "Scontrino" });
        }
        lines.push({ type: "divider" });
        if (tmpl?.showOrderNumber ?? true) lines.push({ type: "item", left: "Ordine", right: `#${displayNum}` });
        if (tmpl?.showTimestamp ?? true) lines.push({ type: "item", left: "Data", right: new Date(p.paidAt).toLocaleString("it-IT") });
        lines.push({ type: "divider" });
      }
      for (const item of jobItems) {
        lines.push({ type: "item", left: `${item.quantity}x ${item.name}`, right: `€${(item.unitPrice * item.quantity).toFixed(2)}` });
      }
      lines.push({ type: "divider" });
      lines.push({ type: "total", left: "TOTALE", right: `€${jobTotal.toFixed(2)}` });
      if (!categoryName && (tmpl?.showPaymentMethod ?? true)) lines.push({ type: "item", left: "Pagamento", right: p.method });
      lines.push({ type: "divider" });
      if (!categoryName && tmpl?.footerText) {
        lines.push({ type: "text", content: "" });
        lines.push({ type: "text", content: tmpl.footerText });
      }
      return lines;
    }

    // Helper: print one receipt (image or text mode)
    async function printOneReceipt(
      tmpl: typeof masterTemplate,
      jobItems: typeof items,
      jobTotal: number,
      categoryName?: string,
    ): Promise<void> {
      const useImageMode = tmpl?.printMode === "image" && !!tmpl?.blocks;
      if (useImageMode) {
        const blocks = JSON.parse(tmpl!.blocks!) as ReceiptBlock[];
        const pngBuffer = await renderReceiptImage({
          blocks,
          canvasWidth: tmpl!.canvasWidth ?? 576,
          logoPath: resolvedLogoPath,
          orderId: p.orderId,
          receiptDisplay: displayNum,
          items: jobItems.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
          total: jobTotal,
          paymentMethod: p.method,
          currency: p.currency,
          paidAt: new Date(p.paidAt),
          restaurantName: rMap["restaurant_name"] ?? "",
          restaurantAddress: rMap["restaurant_address"] ?? "",
          restaurantCity: rMap["restaurant_city"] ?? "",
          restaurantVat: rMap["restaurant_vat"] ?? "",
          restaurantPhone: rMap["restaurant_phone"] ?? "",
          ...(categoryName !== undefined ? { categoryName } : {}),
        });
        const rasterBuffer = await pngToEscposRaster(pngBuffer, tmpl!.canvasWidth ?? 576);
        const result = await printerService.printDirect({
          printerId: receiptPrinter.id,
          contentBuffer: rasterBuffer,
          type: "receipt",
          ...(printerConfig ? { printerConfig } : {}),
        });
        logger.info({ result, printerId: receiptPrinter.id, mode: "image", printMethod }, "Print result");
      } else {
        const lines = buildTextLines(tmpl, jobItems, jobTotal, categoryName);
        const content = formatReceipt(lines);
        const result = await printerService.printDirect({
          printerId: receiptPrinter.id,
          content,
          type: "receipt",
          ...(printerConfig ? { printerConfig } : {}),
        });
        logger.info({ result, printerId: receiptPrinter.id, mode: "text", printMethod }, "Print result");
      }
    }

    // Build and execute print jobs based on printMethod
    const allTotal = p.amount;

    if (printMethod === "by_category" || printMethod === "by_category_copy") {
      // Group items by category
      const grouped = new Map<string, { name: string; items: typeof items }>();
      for (const item of items) {
        const catId = productCategoryMap[item.productId] ?? "__none__";
        const catName = catId !== "__none__" ? (categoryNameMap[catId] ?? "Senza categoria") : "Senza categoria";
        const existing = grouped.get(catId) ?? { name: catName, items: [] };
        existing.items.push(item);
        grouped.set(catId, existing);
      }
      for (const { name, items: catItems } of grouped.values()) {
        const catTotal = catItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        await printOneReceipt(subTemplate ?? masterTemplate, catItems, catTotal, name);
      }
      if (printMethod === "by_category_copy") {
        await printOneReceipt(copyTemplate ?? masterTemplate, items, allTotal);
      }
    } else if (printMethod === "per_item" || printMethod === "per_item_copy") {
      for (const item of items) {
        const itemTotal = item.unitPrice * item.quantity;
        await printOneReceipt(subTemplate ?? masterTemplate, [item], itemTotal);
      }
      if (printMethod === "per_item_copy") {
        await printOneReceipt(copyTemplate ?? masterTemplate, items, allTotal);
      }
    } else {
      // "single" — default
      await printOneReceipt(masterTemplate, items, allTotal);
    }
  });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
