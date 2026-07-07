import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { claimEvent, eq, sql, inArray, and, shifts, printers, receiptTemplates, orders, orderItems, orderItemOptions, products, categories, productionCenters, productionCenterCategories, productionCenterPrinters, kitchenTemplates, appSettings, terminals, terminalPrinters, paymentMethods } from "@pos/db";
import { formatReceipt, formatKitchenTicket, renderReceiptImage, renderKitchenImage, pngToEscposRaster, type ReceiptLine } from "@pos/core";
import { formatReceiptNumber, computeVatBreakdown } from "@pos/module-sales";
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

  // Load order-level metadata
  const [orderRow] = await db.select({ tableId: orders.tableId, customerName: orders.customerName, notes: orders.notes, pax: orders.pax })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const tableId = orderRow?.tableId ?? null;
  const customerName = orderRow?.customerName ?? null;
  const orderNotes = orderRow?.notes ?? null;
  const pax = orderRow?.pax ?? null;

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

  // Batch-load product→category, category→productionCenter, center names in 3 queries
  const productIds = [...new Set(items.map((i) => i.productId))];
  const productCatRows = productIds.length > 0
    ? await db.select({ id: products.id, categoryId: products.categoryId })
        .from(products).where(inArray(products.id, productIds))
    : [];
  const productCatMap = new Map(productCatRows.map((r) => [r.id, r.categoryId ?? null]));

  const categoryIds = [...new Set(productCatRows.map((r) => r.categoryId).filter((c): c is string => c !== null))];
  const pcCatRows = categoryIds.length > 0
    ? await db.select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
        .from(productionCenterCategories).where(inArray(productionCenterCategories.categoryId, categoryIds))
    : [];
  // categoryId → productionCenterIds[]
  const catToCenters = new Map<string, string[]>();
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

  // Group items by production center using the pre-loaded maps
  const centerItems: Map<string, { centerName: string; items: OrderItemRow[] }> = new Map();
  const unroutedItems: OrderItemRow[] = [];

  for (const item of items) {
    const categoryId = productCatMap.get(item.productId) ?? null;
    if (!categoryId) { unroutedItems.push(item); continue; }

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
            let blocks: KitchenBlock[];
            try {
              blocks = (typeof template.blocks === "string" ? JSON.parse(template.blocks) : template.blocks) as KitchenBlock[];
            } catch {
              logger.warn({ printerId: printer.id, orderId }, "Kitchen template blocks JSON invalid — falling back to text mode");
              // fall through to text-mode below
              blocks = [];
            }
            if (blocks.length > 0) {
              const pngBuffer = await renderKitchenImage({
                blocks,
                canvasWidth: template.canvasWidth ?? 576,
                logoPath: template.logoPath ? resolve(join(dataDir, template.logoPath)) : null,
                centerName,
                orderId,
                receiptDisplay,
                tableId,
                customerName,
                orderNotes,
                pax,
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
            // blocks empty after parse error — fall through to text
          }
          // Fall through to text if no template
        }

        const content = formatKitchenTicket({
          orderId,
          ...(receiptDisplay !== undefined ? { receiptDisplay } : {}),
          ...(tableId ? { tableId } : {}),
          ...(customerName ? { customerName } : {}),
          ...(orderNotes ? { orderNotes } : {}),
          ...(pax ? { pax } : {}),
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
        ...(payload.terminalId !== undefined ? { terminalId: payload.terminalId } : {}),
      },
      timestamp: new Date(),
    });
  });

  eventBus.on("PRINT_JOB_QUEUED", async (payload) => {
    if (payload.type !== "receipt") return;

    // Check if multi-terminal mode is enabled
    const [multiTerminalRow] = await db.select().from(appSettings).where(eq(appSettings.key, "multi_terminal_enabled")).limit(1);
    const multiTerminalEnabled = multiTerminalRow?.value === "true";

    const terminalId = (payload.payload as { terminalId?: string }).terminalId ?? null;

    let receiptPrinterFound: PrinterRow | undefined;

    if (multiTerminalEnabled && terminalId) {
      const tpRows = await db.select().from(terminalPrinters).where(eq(terminalPrinters.terminalId, terminalId));
      if (tpRows.length > 0) {
        const tpIds = tpRows.map((r) => r.printerId);
        const tPrinters = await db.select().from(printers).where(and(eq(printers.active, true), inArray(printers.id, tpIds))) as unknown as PrinterRow[];
        receiptPrinterFound = tPrinters.find((p) => p.receiptEnabled);
      }
    }

    // Global fallback
    if (!receiptPrinterFound) {
      const activePrinters = await db.select().from(printers).where(eq(printers.active, true)) as unknown as PrinterRow[];
      receiptPrinterFound = activePrinters.find((p) => p.receiptEnabled);
    }

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

    // Load order items from DB with vatRate from products
    const rawItems = await db.select({
      id:        orderItems.id,
      orderId:   orderItems.orderId,
      productId: orderItems.productId,
      name:      orderItems.name,
      quantity:  orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      notes:     orderItems.notes,
      vatRate:   products.vatRate,
    })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, p.orderId));
    const items = rawItems as typeof rawItems;

    // Load restaurant info + receipt number settings + logo
    const settingKeys = ["restaurant_name", "restaurant_address", "restaurant_city", "restaurant_vat", "restaurant_phone", "receipt_number_prefix", "receipt_number_padding", "restaurant_logo_path"];
    const restaurantRows = await db.select().from(appSettings).where(inArray(appSettings.key, settingKeys));
    const rMap = Object.fromEntries(restaurantRows.map((r) => [r.key, r.value]));

    // Load order receipt number and fiscal data
    const [orderRow] = await db.select({
      receiptNumber:   orders.receiptNumber,
      discountAmount:  orders.discountAmount,
      totalAmount:     orders.totalAmount,
      fiscalDocNumber: orders.fiscalDocNumber,
      fiscalDocDate:   orders.fiscalDocDate,
      fiscalRtSerial:  orders.fiscalRtSerial,
      terminalId:      orders.terminalId,
      tableId:         orders.tableId,
      customerName:    orders.customerName,
    }).from(orders).where(eq(orders.id, p.orderId)).limit(1);
    const numPrefix = rMap["receipt_number_prefix"] ?? "";
    const numPadding = parseInt(rMap["receipt_number_padding"] ?? "0", 10);
    const displayNum = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, p.orderId, numPrefix, numPadding);

    // Resolve the order's terminal name (shown on receipt only when multi-terminal is on)
    let orderTerminalName: string | undefined;
    if (multiTerminalEnabled && orderRow?.terminalId) {
      const [t] = await db.select({ name: terminals.name }).from(terminals).where(eq(terminals.id, orderRow.terminalId)).limit(1);
      orderTerminalName = t?.name;
    }

    // Resolve the payment method's display name (payments.method stores the paymentMethods.id)
    const [paymentMethodRow] = await db.select({ name: paymentMethods.name }).from(paymentMethods).where(eq(paymentMethods.id, p.method)).limit(1);
    const paymentMethodName = paymentMethodRow?.name ?? p.method;

    // Resolve logo path
    const rawLogoPath = rMap["restaurant_logo_path"];
    const absLogoPath = rawLogoPath ? resolve(join(fastify.ctx.config.dataDir, rawLogoPath)) : null;
    const resolvedLogoPath = (absLogoPath && existsSync(absLogoPath)) ? absLogoPath : null;

    const printerConfig = receiptPrinter.host && receiptPrinter.port
      ? { host: receiptPrinter.host, port: receiptPrinter.port }
      : undefined;

    // Lookup product→category mapping (needed for non-single methods and for the per-center separate-slip filter)
    let productCategoryMap: Record<string, string | null> = {};
    let categoryNameMap: Record<string, string> = {};
    let productPrintModeMap: Record<string, string> = {};
    // category→ALL productionCenters mapping (a category can belong to more than one center)
    let categoryCentersMap: Record<string, string[]> = {};
    let categoryFirstCenterMap: Record<string, string> = {}; // used only for by_center grouping (needs one bucket per category)
    let centerNameMap: Record<string, string> = {};
    let centerPrintModeMap: Record<string, string> = {};
    if (items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const productRows = await db
        .select({ id: products.id, categoryId: products.categoryId, receiptPrintMode: products.receiptPrintMode })
        .from(products)
        .where(inArray(products.id, productIds));
      productCategoryMap = Object.fromEntries(productRows.map((pr) => [pr.id, pr.categoryId ?? null]));
      productPrintModeMap = Object.fromEntries(productRows.map((pr) => [pr.id, pr.receiptPrintMode]));
      const categoryIds = [...new Set(productRows.map((pr) => pr.categoryId).filter(Boolean))] as string[];
      if (categoryIds.length > 0) {
        const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds));
        categoryNameMap = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));

        const pcCatRows = await db
          .select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
          .from(productionCenterCategories)
          .where(inArray(productionCenterCategories.categoryId, categoryIds));
        // a category can be linked to multiple production centers — keep all of them
        for (const r of pcCatRows) {
          const arr = categoryCentersMap[r.categoryId] ?? [];
          arr.push(r.productionCenterId);
          categoryCentersMap[r.categoryId] = arr;
          if (!categoryFirstCenterMap[r.categoryId]) categoryFirstCenterMap[r.categoryId] = r.productionCenterId;
        }
        const centerIds = [...new Set(Object.values(categoryCentersMap).flat())];
        if (centerIds.length > 0) {
          const centerRows = await db
            .select({ id: productionCenters.id, name: productionCenters.name, receiptPrintMode: productionCenters.receiptPrintMode })
            .from(productionCenters)
            .where(inArray(productionCenters.id, centerIds));
          centerNameMap = Object.fromEntries(centerRows.map((c) => [c.id, c.name]));
          centerPrintModeMap = Object.fromEntries(centerRows.map((c) => [c.id, c.receiptPrintMode]));
        }
      }
    }
    // Back-compat alias used by the by_category/by_center grouping below (1 center per category is enough there)
    const categoryCenterMap = categoryFirstCenterMap;

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
        if (orderTerminalName) lines.push({ type: "item", left: "Cassa", right: orderTerminalName });
        if (orderRow?.tableId) lines.push({ type: "item", left: "Tavolo", right: orderRow.tableId });
        if (orderRow?.customerName) lines.push({ type: "item", left: "Cliente", right: orderRow.customerName });
        lines.push({ type: "divider" });
      }
      for (const item of jobItems) {
        lines.push({ type: "item", left: `${item.quantity}x ${item.name}`, right: `€${(item.unitPrice * item.quantity).toFixed(2)}` });
        if (tmpl?.showItemCategory) {
          const catId = productCategoryMap[item.productId] ?? null;
          const catName = catId ? categoryNameMap[catId] : undefined;
          if (catName) lines.push({ type: "text", content: `  ${catName}` });
        }
      }
      lines.push({ type: "divider" });
      lines.push({ type: "total", left: "TOTALE", right: `€${jobTotal.toFixed(2)}` });
      if (!categoryName && (tmpl?.showPaymentMethod ?? true)) lines.push({ type: "item", left: "Pagamento", right: paymentMethodName });

      // VAT breakdown
      if (!categoryName) {
        const vatItems = jobItems.map((i) => ({ id: i.id, productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: (i as { vatRate?: number | null }).vatRate ?? 10 }));
        const vatBreakdown = computeVatBreakdown(vatItems, orderRow?.discountAmount ?? 0, jobTotal);
        if (vatBreakdown.length > 0) {
          lines.push({ type: "divider" });
          for (const vb of vatBreakdown) {
            lines.push({ type: "item", left: `IVA ${vb.rate}%`, right: `€${vb.tax.toFixed(2)}` });
            lines.push({ type: "item", left: `  Imponibile`, right: `€${vb.taxable.toFixed(2)}` });
          }
        }
      }

      // Fiscal footer (doc. commerciale number from RT)
      if (!categoryName && orderRow?.fiscalDocNumber) {
        lines.push({ type: "divider" });
        lines.push({ type: "text", content: `Doc. Comm. n. ${orderRow.fiscalDocNumber}` });
        if (orderRow.fiscalDocDate) lines.push({ type: "text", content: orderRow.fiscalDocDate });
        if (orderRow.fiscalRtSerial) lines.push({ type: "text", content: `RT: ${orderRow.fiscalRtSerial}` });
      }

      lines.push({ type: "divider" });
      if (!categoryName && tmpl?.footerText) {
        lines.push({ type: "text", content: "" });
        lines.push({ type: "text", content: tmpl.footerText });
      }
      return lines;
    }

    // Helper: print one receipt (image or text mode)
    // groupName defined → sub-slip: injects category-name block at top, rest identical to preview
    // groupName undefined → full receipt (master or client copy)
    async function printOneReceipt(
      tmpl: typeof masterTemplate,
      jobItems: typeof items,
      jobTotal: number,
      groupName?: string,
    ): Promise<void> {
      const isSub = groupName !== undefined;
      const useImageMode = tmpl?.printMode === "image" && !!tmpl?.blocks;

      if (useImageMode) {
        let blocks: ReceiptBlock[];
        try {
          blocks = (typeof tmpl!.blocks === "string" ? JSON.parse(tmpl!.blocks!) : tmpl!.blocks) as ReceiptBlock[];
        } catch {
          logger.warn({ jobId: payload.jobId }, "Receipt template blocks JSON invalid — falling back to text mode");
          return printOneReceipt({ ...tmpl!, printMode: "text" }, jobItems, jobTotal, groupName);
        }

        // For sub-slips inject category-name block at top; all other blocks unchanged
        const firstBlock = blocks.find((b) => b.visible);
        const effectiveBlocks: ReceiptBlock[] = isSub ? [...blocks] : blocks;

        const pngBuffer = await renderReceiptImage({
          blocks: effectiveBlocks,
          canvasWidth: tmpl!.canvasWidth ?? 576,
          logoPath: resolvedLogoPath,
          orderId: p.orderId,
          receiptDisplay: displayNum,
          items: jobItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            ...(() => {
              const catId = productCategoryMap[i.productId] ?? null;
              const catName = catId ? categoryNameMap[catId] : undefined;
              return catName ? { category: catName } : {};
            })(),
          })),
          showItemCategory: tmpl?.showItemCategory ?? false,
          total: jobTotal,
          paymentMethod: paymentMethodName,
          currency: p.currency,
          paidAt: new Date(p.paidAt),
          restaurantName: rMap["restaurant_name"] ?? "",
          restaurantAddress: rMap["restaurant_address"] ?? "",
          restaurantCity: rMap["restaurant_city"] ?? "",
          restaurantVat: rMap["restaurant_vat"] ?? "",
          restaurantPhone: rMap["restaurant_phone"] ?? "",
          ...(isSub ? { categoryName: groupName } : {}),
          ...(orderTerminalName ? { terminalName: orderTerminalName } : {}),
          ...(orderRow?.tableId ? { tableId: orderRow.tableId } : {}),
          ...(orderRow?.customerName ? { customerName: orderRow.customerName } : {}),
        });
        const rasterBuffer = await pngToEscposRaster(pngBuffer, tmpl!.canvasWidth ?? 576);
        const result = await printerService.printDirect({
          printerId: receiptPrinter.id,
          contentBuffer: rasterBuffer,
          type: "receipt",
          ...(printerConfig ? { printerConfig } : {}),
        });
        logger.info({ result, printerId: receiptPrinter.id, mode: "image", printMethod, isSub }, "Print result");
      } else {
        const lines = buildTextLines(tmpl, jobItems, jobTotal, groupName);
        const content = formatReceipt(lines);
        const result = await printerService.printDirect({
          printerId: receiptPrinter.id,
          content,
          type: "receipt",
          ...(printerConfig ? { printerConfig } : {}),
        });
        logger.info({ result, printerId: receiptPrinter.id, mode: "text", printMethod, isSub }, "Print result");
      }
    }

    // Classify items whose product/center is configured as "separate": each such group gets its own
    // standalone slip on the main receipt printer. Everything else always stays together as a single
    // block (never re-split by printMethod) and is printed in full as the client copy.
    // A product override of "included" always wins and never generates a separate slip.
    const separateGroups = new Map<string, { name: string; items: typeof items }>();
    for (const item of items) {
      const productMode = productPrintModeMap[item.productId] ?? "inherit";
      if (productMode === "included") continue;
      if (productMode === "separate") {
        const key = `product:${item.productId}`;
        const existing = separateGroups.get(key) ?? { name: item.name, items: [] };
        existing.items.push(item);
        separateGroups.set(key, existing);
        continue;
      }
      // "inherit" — fall back to the item's production center(s)
      const catId = productCategoryMap[item.productId] ?? null;
      const centerIds = catId ? (categoryCentersMap[catId] ?? []) : [];
      const separateCenterId = centerIds.find((cid) => centerPrintModeMap[cid] === "separate");
      if (separateCenterId) {
        const centerName = centerNameMap[separateCenterId] ?? "Centro";
        const existing = separateGroups.get(separateCenterId) ?? { name: centerName, items: [] };
        existing.items.push(item);
        separateGroups.set(separateCenterId, existing);
      }
    }

    const allTotal = p.amount;

    if (separateGroups.size > 0) {
      // Selective separation is configured: it takes over completely and ignores printMethod.
      // Each isolated in its own try/catch so one failing job doesn't block the others.
      for (const { name, items: sepItems } of separateGroups.values()) {
        try {
          const sepTotal = sepItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt(subTemplate ?? masterTemplate, sepItems, sepTotal, name);
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Separate slip print failed — continuing with the rest");
        }
      }
      try {
        await printOneReceipt(copyTemplate ?? masterTemplate, items, allTotal);
      } catch (err) {
        logger.error({ err, jobId: payload.jobId }, "Client copy print failed");
      }
      return;
    }

    // No selective separation configured — fall back to the template's printMethod exactly as before.
    const mainItems = items;

    if (printMethod === "by_category" || printMethod === "by_category_copy") {
      // Group items by category
      const grouped = new Map<string, { name: string; items: typeof items }>();
      for (const item of mainItems) {
        const catId = productCategoryMap[item.productId] ?? "__none__";
        const catName = catId !== "__none__" ? (categoryNameMap[catId] ?? "Senza categoria") : "Senza categoria";
        const existing = grouped.get(catId) ?? { name: catName, items: [] };
        existing.items.push(item);
        grouped.set(catId, existing);
      }
      for (const { name, items: catItems } of grouped.values()) {
        try {
          const catTotal = catItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt(subTemplate ?? masterTemplate, catItems, catTotal, name);
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Category slip print failed — continuing with the rest");
        }
      }
      if (printMethod === "by_category_copy") {
        await printOneReceipt(copyTemplate ?? masterTemplate, mainItems, allTotal);
      }
    } else if (printMethod === "by_center" || printMethod === "by_center_copy") {
      // Group items by production center (products without a center go into "__none__")
      const grouped = new Map<string, { name: string; items: typeof items }>();
      for (const item of mainItems) {
        const catId = productCategoryMap[item.productId] ?? null;
        const centerId = (catId && categoryCenterMap[catId]) ? categoryCenterMap[catId]! : "__none__";
        const centerName = centerId !== "__none__" ? (centerNameMap[centerId] ?? "Senza centro") : "Senza centro";
        const existing = grouped.get(centerId) ?? { name: centerName, items: [] };
        existing.items.push(item);
        grouped.set(centerId, existing);
      }
      for (const { name, items: centerItems } of grouped.values()) {
        try {
          const centerTotal = centerItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          await printOneReceipt(subTemplate ?? masterTemplate, centerItems, centerTotal, name);
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, group: name }, "Center slip print failed — continuing with the rest");
        }
      }
      if (printMethod === "by_center_copy") {
        await printOneReceipt(copyTemplate ?? masterTemplate, mainItems, allTotal);
      }
    } else if (printMethod === "per_item" || printMethod === "per_item_copy") {
      for (const item of mainItems) {
        try {
          const itemTotal = item.unitPrice * item.quantity;
          await printOneReceipt(subTemplate ?? masterTemplate, [item], itemTotal);
        } catch (err) {
          logger.error({ err, jobId: payload.jobId, itemName: item.name }, "Per-item slip print failed — continuing with the rest");
        }
      }
      if (printMethod === "per_item_copy") {
        await printOneReceipt(copyTemplate ?? masterTemplate, mainItems, allTotal);
      }
    } else {
      // "single" — default
      await printOneReceipt(masterTemplate, mainItems, allTotal);
    }
  });
};

export default fp(printerTriggerPlugin, {
  name: "printer-trigger",
  dependencies: ["core-context"],
});
