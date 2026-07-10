import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { eq, inArray, and } from "@pos/db";
import { appSettings, orders, products, categories, productionCenters, productionCenterCategories, orderItems, paymentMethods, terminals, printers, terminalPrinters } from "@pos/db";
import { formatReceiptNumber } from "@pos/module-sales";
import type { DbClient } from "@pos/db";
import type { OrderItemRow, PrinterRow, ReceiptContext, ReceiptJobData } from "./types.js";

export async function loadExpressMode(db: DbClient): Promise<boolean> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "express_mode"));
  return rows[0]?.value === "true";
}

export async function loadReceiptNumSettings(db: DbClient): Promise<{ prefix: string; padding: number }> {
  const keys = ["receipt_number_prefix", "receipt_number_padding"];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    prefix: m["receipt_number_prefix"] ?? "",
    padding: parseInt(m["receipt_number_padding"] ?? "0", 10),
  };
}

export async function loadMultiTerminalEnabled(db: DbClient): Promise<boolean> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "multi_terminal_enabled")).limit(1);
  return row?.value === "true";
}

export async function resolveReceiptPrinter(
  db: DbClient,
  multiTerminalEnabled: boolean,
  terminalId: string | null,
): Promise<PrinterRow | undefined> {
  if (multiTerminalEnabled && terminalId) {
    const tpRows = await db.select().from(terminalPrinters).where(eq(terminalPrinters.terminalId, terminalId));
    if (tpRows.length > 0) {
      const tpIds = tpRows.map((r) => r.printerId);
      const tPrinters = await db.select().from(printers)
        .where(and(eq(printers.active, true), inArray(printers.id, tpIds))) as unknown as PrinterRow[];
      const found = tPrinters.find((p) => p.receiptEnabled);
      if (found) return found;
    }
  }
  const activePrinters = await db.select().from(printers).where(eq(printers.active, true)) as unknown as PrinterRow[];
  return activePrinters.find((p) => p.receiptEnabled);
}

export async function loadReceiptContext(
  db: DbClient,
  p: ReceiptJobData,
  multiTerminalEnabled: boolean,
  dataDir: string,
): Promise<ReceiptContext> {
  const settingKeys = [
    "restaurant_name", "restaurant_address", "restaurant_city",
    "restaurant_vat", "restaurant_phone", "receipt_number_prefix",
    "receipt_number_padding", "restaurant_logo_path",
  ];
  const restaurantRows = await db.select().from(appSettings).where(inArray(appSettings.key, settingKeys));
  const rMap = Object.fromEntries(restaurantRows.map((r) => [r.key, r.value]));

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

  const numPrefix  = rMap["receipt_number_prefix"] ?? "";
  const numPadding = parseInt(rMap["receipt_number_padding"] ?? "0", 10);
  const displayNum = formatReceiptNumber(orderRow?.receiptNumber ?? undefined, p.orderId, numPrefix, numPadding);

  let orderTerminalName: string | undefined;
  if (multiTerminalEnabled && orderRow?.terminalId) {
    const [t] = await db.select({ name: terminals.name }).from(terminals).where(eq(terminals.id, orderRow.terminalId)).limit(1);
    orderTerminalName = t?.name;
  }

  const [paymentMethodRow] = await db.select({ name: paymentMethods.name }).from(paymentMethods).where(eq(paymentMethods.id, p.method)).limit(1);
  const paymentMethodName = paymentMethodRow?.name ?? p.method;

  const rawLogoPath  = rMap["restaurant_logo_path"];
  const absLogoPath  = rawLogoPath ? resolve(join(dataDir, rawLogoPath)) : null;
  const resolvedLogoPath = (absLogoPath && existsSync(absLogoPath)) ? absLogoPath : null;

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

  const items = rawItems as OrderItemRow[];

  let productCategoryMap: Record<string, string | null> = {};
  let categoryNameMap: Record<string, string> = {};
  let productPrintModeMap: Record<string, string> = {};
  let categoryCentersMap: Record<string, string[]> = {};
  let categoryFirstCenterMap: Record<string, string> = {};
  let centerNameMap: Record<string, string> = {};
  let centerPrintModeMap: Record<string, string> = {};

  if (items.length > 0) {
    const productIds  = [...new Set(items.map((i) => i.productId))];
    const productRows = await db
      .select({ id: products.id, categoryId: products.categoryId, receiptPrintMode: products.receiptPrintMode })
      .from(products)
      .where(inArray(products.id, productIds));
    productCategoryMap  = Object.fromEntries(productRows.map((pr) => [pr.id, pr.categoryId ?? null]));
    productPrintModeMap = Object.fromEntries(productRows.map((pr) => [pr.id, pr.receiptPrintMode]));

    const categoryIds = [...new Set(productRows.map((pr) => pr.categoryId).filter(Boolean))] as string[];
    if (categoryIds.length > 0) {
      const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds));
      categoryNameMap = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]));

      const pcCatRows = await db
        .select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
        .from(productionCenterCategories)
        .where(inArray(productionCenterCategories.categoryId, categoryIds));

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
        centerNameMap      = Object.fromEntries(centerRows.map((c) => [c.id, c.name]));
        centerPrintModeMap = Object.fromEntries(centerRows.map((c) => [c.id, c.receiptPrintMode]));
      }
    }
  }

  return {
    items,
    orderRow,
    restaurant: {
      name:     rMap["restaurant_name"]    ?? "",
      address:  rMap["restaurant_address"] ?? "",
      city:     rMap["restaurant_city"]    ?? "",
      vat:      rMap["restaurant_vat"]     ?? "",
      phone:    rMap["restaurant_phone"]   ?? "",
      logoPath: resolvedLogoPath,
    },
    displayNum,
    paymentMethodName,
    orderTerminalName,
    resolvedLogoPath,
    productCategoryMap,
    categoryNameMap,
    productPrintModeMap,
    categoryCentersMap,
    categoryFirstCenterMap,
    centerNameMap,
    centerPrintModeMap,
  };
}
