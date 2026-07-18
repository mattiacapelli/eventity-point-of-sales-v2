import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { formatReceipt, renderShiftReportImage, pngToEscposRaster, type ReceiptLine } from "@pos/core";
import {
  eq, and, gte, lte, inArray,
  orders, orderItems, products, categories, payments, shifts,
  productionCenters, productionCenterCategories, printers, terminalPrinters,
  appSettings, shiftReportTemplates, terminals, paymentMethods,
  type DbClient,
} from "@pos/db";

// Ordini "pagati": confirmed (pagato, in prep) + completed (consegnato)
const PAID_STATUSES = ["confirmed", "completed"] as const;
import type { ShiftReportBlock } from "@pos/shared-types";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const RESTAURANT_KEYS = ["restaurant_name", "restaurant_address", "restaurant_city", "restaurant_vat", "restaurant_phone", "restaurant_logo_path"] as const;

async function getShiftFullStats(db: DbClient, shiftId: number, terminalId?: number) {
  const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (!shift) return null;

  const shiftOrders = await db.select().from(orders).where(
    and(eq(orders.shiftId, shiftId), terminalId !== undefined ? eq(orders.terminalId, terminalId) : undefined)
  );

  const completedOrders = shiftOrders.filter((o) => PAID_STATUSES.includes(o.status as typeof PAID_STATUSES[number]));
  const cancelledOrders = shiftOrders.filter((o) => o.status === "cancelled");
  const orderIds = completedOrders.map((o) => o.id);

  // Determine which payment methods are configured to be excluded from the "totale generale"
  const allMethodRows = await db.select({ id: paymentMethods.id, name: paymentMethods.name, excludeFromTotal: paymentMethods.excludeFromTotal }).from(paymentMethods);
  const excludedMethodIds = new Set(allMethodRows.filter((m) => m.excludeFromTotal).map((m) => m.id));
  const methodIdToName = Object.fromEntries(allMethodRows.map((m) => [m.id, m.name]));

  // Map orderId -> payment method (at most one "completed" payment per order, enforced at DB level)
  let orderMethodMap: Record<number, string> = {};
  if (excludedMethodIds.size > 0 && orderIds.length > 0) {
    const completedPmtRows = await db.select({ orderId: payments.orderId, method: payments.method })
      .from(payments)
      .where(and(inArray(payments.orderId, orderIds), eq(payments.status, "completed")));
    orderMethodMap = Object.fromEntries(completedPmtRows.map((p) => [p.orderId, p.method]));
  }
  const isOrderExcluded = (orderId: number) => {
    const method = orderMethodMap[orderId];
    return method !== undefined && excludedMethodIds.has(method);
  };

  const totalSalesRaw = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalSalesExcluded = completedOrders.filter((o) => isOrderExcluded(o.id)).reduce((sum, o) => sum + o.totalAmount, 0);
  const totalSales = totalSalesRaw - totalSalesExcluded;
  const totalOrders = completedOrders.length;
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

  const shiftMeta = {
    id: shift.id,
    openedAt: new Date(shift.openedAt).toISOString(),
    closedAt: shift.closedAt ? new Date(shift.closedAt).toISOString() : null,
    openingCash: shift.openingCash,
    closingCash: shift.closingCash ?? null,
    notes: shift.notes ?? null,
  };

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, amount: 0 }));
  for (const order of completedOrders) {
    const bucket = byHour[order.createdAt.getHours()]!;
    bucket.orders += 1;
    bucket.amount += order.totalAmount;
  }

  const terminalIds = [...new Set(completedOrders.map((o) => o.terminalId).filter((id): id is number => id !== null && id !== undefined))];
  let terminalNameMap: Record<number, string> = {};
  if (terminalIds.length > 0) {
    const terminalRows = await db.select().from(terminals).where(inArray(terminals.id, terminalIds));
    terminalNameMap = Object.fromEntries(terminalRows.map((t) => [t.id, t.name]));
  }
  // Fetch payments for completed orders to build per-terminal payment method breakdown
  const allPmtRowsForTerminal = orderIds.length > 0
    ? await db.select({ orderId: payments.orderId, method: payments.method, amount: payments.amount, status: payments.status })
        .from(payments).where(and(inArray(payments.orderId, orderIds), eq(payments.status, "completed")))
    : [];
  const orderPaymentMap = new Map<number, { method: string; amount: number }>();
  for (const p of allPmtRowsForTerminal) orderPaymentMap.set(p.orderId, { method: p.method, amount: p.amount });

  const byTerminalAgg: Record<string, { count: number; amount: number; byMethod: Record<string, { count: number; amount: number }> }> = {};
  for (const order of completedOrders) {
    const name = order.terminalId !== null && order.terminalId !== undefined ? (terminalNameMap[order.terminalId] ?? "Sconosciuta") : "Senza cassa";
    const entry = byTerminalAgg[name] ?? { count: 0, amount: 0, byMethod: {} };
    entry.count += 1;
    entry.amount += order.totalAmount;
    const pmt = orderPaymentMap.get(order.id);
    if (pmt) {
      const methodName = methodIdToName[pmt.method] ?? pmt.method;
      const me = entry.byMethod[methodName] ?? { count: 0, amount: 0 };
      me.count += 1;
      me.amount += pmt.amount;
      entry.byMethod[methodName] = me;
    }
    byTerminalAgg[name] = entry;
  }
  const byTerminal = Object.entries(byTerminalAgg).map(([terminalName, v]) => ({
    terminalName,
    count: v.count,
    amount: v.amount,
    byMethod: Object.entries(v.byMethod).map(([method, m]) => ({ method, ...m })),
  }));

  if (orderIds.length === 0) {
    return {
      shift: shiftMeta,
      summary: { totalSales: 0, totalOrders: 0, cancelledOrders: cancelledOrders.length, avgTicket: 0, refundTotal: 0, netSales: 0, totalSalesExcluded: 0 },
      byPaymentMethod: [] as { method: string; count: number; amount: number; excludeFromTotal: boolean }[],
      byCategory: [] as { categoryName: string; quantity: number; amount: number }[],
      byProductionCenter: [] as { centerName: string; quantity: number; amount: number }[],
      byTerminal,
      byHour,
      topProducts: [] as { name: string; quantity: number; amount: number }[],
    };
  }

  const methodExcludeMap = Object.fromEntries(allMethodRows.map((m) => [m.id, m.excludeFromTotal]));
  const byPaymentMethod: Record<string, { count: number; amount: number; excludeFromTotal: boolean }> = {};

  const pmtRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
  for (const p of pmtRows) {
    if (p.status === "completed") {
      const methodName = methodIdToName[p.method] ?? p.method;
      const entry = byPaymentMethod[methodName] ?? { count: 0, amount: 0, excludeFromTotal: methodExcludeMap[p.method] ?? false };
      entry.count++;
      entry.amount += p.amount;
      byPaymentMethod[methodName] = entry;
    }
  }
  const refundTotal = pmtRows.filter((p) => p.status === "refunded").reduce((sum, p) => sum + p.amount, 0);

  const byCategory: Record<string, { quantity: number; amount: number }> = {};
  const byProduct: Record<string, { name: string; quantity: number; amount: number }> = {};
  const byProductionCenter: Record<string, { quantity: number; amount: number }> = {};

  const itemRows = await db
    .select({
      productId: orderItems.productId,
      itemName: orderItems.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      productionCenterId: products.productionCenterId,
      unitPrice: orderItems.unitPrice,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(orderItems.orderId, orderIds));

  const categoryIds = [...new Set(itemRows.map((i) => i.categoryId).filter((id): id is number => id !== null && id !== undefined))];
  const categoryCenterMap: Record<number, number> = {};
  if (categoryIds.length > 0) {
    const pcCatRows = await db
      .select({ categoryId: productionCenterCategories.categoryId, productionCenterId: productionCenterCategories.productionCenterId })
      .from(productionCenterCategories)
      .where(inArray(productionCenterCategories.categoryId, categoryIds));
    for (const r of pcCatRows) {
      if (!categoryCenterMap[r.categoryId]) categoryCenterMap[r.categoryId] = r.productionCenterId;
    }
  }

  const centerIds = [...new Set([
    ...itemRows.map((i) => i.productionCenterId).filter((id): id is number => id !== null && id !== undefined),
    ...Object.values(categoryCenterMap),
  ])];
  let centerNameMap: Record<number, string> = {};
  if (centerIds.length > 0) {
    const centerRows = await db.select().from(productionCenters).where(inArray(productionCenters.id, centerIds));
    centerNameMap = Object.fromEntries(centerRows.map((c) => [c.id, c.name]));
  }

  for (const item of itemRows) {
    const cat = item.categoryName ?? "Senza categoria";
    if (!byCategory[cat]) byCategory[cat] = { quantity: 0, amount: 0 };
    byCategory[cat].quantity += item.quantity;
    byCategory[cat].amount += item.unitPrice * item.quantity;

    const pid = String(item.productId);
    if (!byProduct[pid]) byProduct[pid] = { name: item.itemName, quantity: 0, amount: 0 };
    byProduct[pid].quantity += item.quantity;
    byProduct[pid].amount += item.unitPrice * item.quantity;

    const centerId = item.productionCenterId ?? (item.categoryId !== null && item.categoryId !== undefined ? categoryCenterMap[item.categoryId] : undefined);
    const centerName = centerId !== undefined && centerId !== null ? (centerNameMap[centerId] ?? "Senza centro") : "Senza centro";
    if (!byProductionCenter[centerName]) byProductionCenter[centerName] = { quantity: 0, amount: 0 };
    byProductionCenter[centerName].quantity += item.quantity;
    byProductionCenter[centerName].amount += item.unitPrice * item.quantity;
  }

  const topProducts = Object.values(byProduct)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    shift: shiftMeta,
    summary: {
      totalSales,
      totalOrders,
      cancelledOrders: cancelledOrders.length,
      avgTicket,
      refundTotal,
      netSales: totalSales - refundTotal,
      totalSalesExcluded,
    },
    byPaymentMethod: Object.entries(byPaymentMethod).map(([method, v]) => ({ method, ...v })),
    byCategory: Object.entries(byCategory).map(([categoryName, v]) => ({ categoryName, ...v })),
    byProductionCenter: Object.entries(byProductionCenter).map(([centerName, v]) => ({ centerName, ...v })),
    byTerminal,
    byHour,
    topProducts,
  };
}

function buildShiftReportLines(stats: NonNullable<Awaited<ReturnType<typeof getShiftFullStats>>>): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  const fmt = (n: number) => `€${n.toFixed(2)}`;

  lines.push({ type: "header", content: "REPORT TURNO" });
  lines.push({ type: "divider" });
  lines.push({ type: "item", left: "Apertura", right: new Date(stats.shift.openedAt).toLocaleString("it-IT") });
  lines.push({ type: "item", left: "Chiusura", right: stats.shift.closedAt ? new Date(stats.shift.closedAt).toLocaleString("it-IT") : "-" });
  lines.push({ type: "item", left: "Fondo apertura", right: fmt(stats.shift.openingCash) });
  lines.push({ type: "item", left: "Fondo chiusura", right: stats.shift.closingCash !== null ? fmt(stats.shift.closingCash) : "-" });
  lines.push({ type: "divider" });

  lines.push({ type: "text", content: "RIEPILOGO" });
  lines.push({ type: "item", left: "Vendite totali", right: fmt(stats.summary.totalSales) });
  lines.push({ type: "item", left: "Ordini", right: String(stats.summary.totalOrders) });
  lines.push({ type: "item", left: "Scontrino medio", right: fmt(stats.summary.avgTicket) });
  lines.push({ type: "item", left: "Ordini annullati", right: String(stats.summary.cancelledOrders) });
  lines.push({ type: "item", left: "Storni", right: fmt(stats.summary.refundTotal) });
  if (stats.summary.totalSalesExcluded > 0) {
    lines.push({ type: "item", left: "Escluso dal totale", right: fmt(stats.summary.totalSalesExcluded) });
  }
  lines.push({ type: "total", left: "TOTALE GENERALE", right: fmt(stats.summary.netSales) });
  lines.push({ type: "divider" });

  const hoursWithSales = stats.byHour.filter((h) => h.orders > 0);
  if (hoursWithSales.length > 0) {
    lines.push({ type: "text", content: "PER FASCIA ORARIA" });
    for (const h of hoursWithSales) {
      lines.push({ type: "item", left: `${String(h.hour).padStart(2, "0")}:00`, right: `${h.orders} ord. — ${fmt(h.amount)}` });
    }
    lines.push({ type: "divider" });
  }

  if (stats.byCategory.length > 0) {
    lines.push({ type: "text", content: "PER CATEGORIA" });
    for (const c of stats.byCategory) {
      lines.push({ type: "item", left: `${c.categoryName} x${c.quantity}`, right: fmt(c.amount) });
    }
    lines.push({ type: "divider" });
  }

  if (stats.byProductionCenter.length > 0) {
    lines.push({ type: "text", content: "PER CENTRO DI PRODUZIONE" });
    for (const c of stats.byProductionCenter) {
      lines.push({ type: "item", left: `${c.centerName} x${c.quantity}`, right: fmt(c.amount) });
    }
    lines.push({ type: "divider" });
  }

  const includedMethods = stats.byPaymentMethod.filter((p) => !p.excludeFromTotal);
  const excludedMethods = stats.byPaymentMethod.filter((p) => p.excludeFromTotal);

  if (includedMethods.length > 0) {
    lines.push({ type: "text", content: "PER METODO DI PAGAMENTO" });
    for (const p of includedMethods) {
      lines.push({ type: "item", left: `${p.method} x${p.count}`, right: fmt(p.amount) });
    }
    lines.push({ type: "divider" });
  }

  if (excludedMethods.length > 0) {
    lines.push({ type: "text", content: "METODI ESCLUSI DAL TOTALE" });
    for (const p of excludedMethods) {
      lines.push({ type: "item", left: `${p.method} x${p.count}`, right: fmt(p.amount) });
    }
    const excludedSubtotal = excludedMethods.reduce((s, p) => s + p.amount, 0);
    lines.push({ type: "total", left: "Subtotale esclusi", right: fmt(excludedSubtotal) });
    lines.push({ type: "divider" });
  }

  if (stats.byTerminal.length > 0) {
    lines.push({ type: "text", content: "PER TERMINALE" });
    for (const t of stats.byTerminal) {
      lines.push({ type: "item", left: `${t.terminalName} x${t.count}`, right: fmt(t.amount) });
      for (const m of t.byMethod) {
        lines.push({ type: "item", left: `  ${m.method} x${m.count}`, right: fmt(m.amount) });
      }
    }
    lines.push({ type: "divider" });
  }

  if (stats.topProducts.length > 0) {
    lines.push({ type: "text", content: "TOP PRODOTTI" });
    for (const p of stats.topProducts) {
      lines.push({ type: "item", left: `${p.name} x${p.quantity}`, right: fmt(p.amount) });
    }
    lines.push({ type: "divider" });
  }

  return lines;
}

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, _reply) => {
    await fastify.authenticate(request);
  });

  // GET /api/stats/shift/:shiftId
  fastify.get("/stats/shift/:shiftId", {
    schema: { tags: ["stats"], summary: "Stats for a specific shift" },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const numShiftId = parseInt(shiftId, 10);
    const db = fastify.ctx.db;

    const completedOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shiftId, numShiftId), inArray(orders.status, [...PAID_STATUSES])));

    const orderIds = completedOrders.map((o) => o.id);
    const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = completedOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const byPaymentMethod: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    if (orderIds.length > 0) {
      const methodRows = await db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods);
      const methodIdToName = Object.fromEntries(methodRows.map((m) => [m.id, m.name]));
      const pmtRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
      for (const p of pmtRows) {
        const methodName = methodIdToName[p.method] ?? p.method;
        byPaymentMethod[methodName] = (byPaymentMethod[methodName] ?? 0) + p.amount;
      }

      const itemRows = await db
        .select({
          categoryName: categories.name,
          unitPrice: orderItems.unitPrice,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(orderItems.orderId, orderIds));

      for (const item of itemRows) {
        const cat = item.categoryName ?? "Senza categoria";
        byCategory[cat] = (byCategory[cat] ?? 0) + item.unitPrice * item.quantity;
      }
    }

    return reply.send({
      totalSales,
      totalOrders,
      avgTicket,
      byPaymentMethod: Object.entries(byPaymentMethod).map(([method, amount]) => ({ method, amount })),
      byCategory: Object.entries(byCategory).map(([categoryName, amount]) => ({ categoryName, amount })),
    });
  });

  // GET /api/stats/period?from=&to=[&terminalId=]
  fastify.get("/stats/period", {
    schema: {
      tags: ["stats"],
      summary: "Stats for a time period",
      querystring: {
        type: "object",
        required: ["from", "to"],
        properties: {
          from:       { type: "number" },
          to:         { type: "number" },
          terminalId: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const { from, to, terminalId } = request.query as { from: number; to: number; terminalId?: number };
    const db = fastify.ctx.db;

    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, [...PAID_STATUSES]),
          gte(orders.createdAt, new Date(from)),
          lte(orders.createdAt, new Date(to)),
          terminalId !== undefined ? eq(orders.terminalId, terminalId) : undefined,
        )
      );

    const orderIds = completedOrders.map((o) => o.id);
    const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = completedOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const byCategory: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    if (orderIds.length > 0) {
      const itemRows = await db
        .select({
          categoryName: categories.name,
          unitPrice: orderItems.unitPrice,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(orderItems.orderId, orderIds));

      for (const item of itemRows) {
        const cat = item.categoryName ?? "Senza categoria";
        byCategory[cat] = (byCategory[cat] ?? 0) + item.unitPrice * item.quantity;
      }
    }

    for (const order of completedOrders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + order.totalAmount;
    }

    return reply.send({
      totalSales,
      totalOrders,
      avgTicket,
      byCategory: Object.entries(byCategory).map(([categoryName, amount]) => ({ categoryName, amount })),
      byDay: Object.entries(byDay).sort().map(([date, sales]) => ({ date, sales })),
    });
  });

  // GET /api/stats/zreport/:shiftId — Z-report (end-of-shift summary)
  fastify.get("/stats/zreport/:shiftId", {
    schema: {
      tags: ["stats"],
      summary: "Z-report for end-of-shift: totals by payment method, category, and top products",
    },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const numShiftId = parseInt(shiftId, 10);
    const db = fastify.ctx.db;

    const [shift] = await db.select().from(shifts).where(eq(shifts.id, numShiftId)).limit(1);
    if (!shift) return reply.status(404).send({ error: "Shift not found" });

    const shiftOrders = await db.select().from(orders).where(eq(orders.shiftId, numShiftId));

    const completedOrders = shiftOrders.filter((o) => PAID_STATUSES.includes(o.status as typeof PAID_STATUSES[number]));
    const cancelledOrders = shiftOrders.filter((o) => o.status === "cancelled");
    const orderIds = completedOrders.map((o) => o.id);

    const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = completedOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const shiftMeta = {
      id: shift.id,
      openedAt: new Date(shift.openedAt).toISOString(),
      closedAt: shift.closedAt ? new Date(shift.closedAt).toISOString() : null,
      openingCash: shift.openingCash,
      closingCash: shift.closingCash ?? null,
      notes: shift.notes ?? null,
    };

    if (orderIds.length === 0) {
      return reply.send({
        shift: shiftMeta,
        summary: { totalSales: 0, totalOrders: 0, cancelledOrders: cancelledOrders.length, avgTicket: 0, refundTotal: 0, netSales: 0 },
        byPaymentMethod: [],
        byCategory: [],
        topProducts: [],
      });
    }

    const byPaymentMethod: Record<string, { count: number; amount: number }> = {};

    const methodRows = await db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods);
    const methodIdToName = Object.fromEntries(methodRows.map((m) => [m.id, m.name]));
    const pmtRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
    for (const p of pmtRows) {
      if (p.status === "completed") {
        const methodName = methodIdToName[p.method] ?? p.method;
        const entry = byPaymentMethod[methodName] ?? { count: 0, amount: 0 };
        entry.count++;
        entry.amount += p.amount;
        byPaymentMethod[methodName] = entry;
      }
    }
    const refundTotal = pmtRows.filter((p) => p.status === "refunded").reduce((sum, p) => sum + p.amount, 0);

    const byCategory: Record<string, { quantity: number; amount: number }> = {};
    const byProduct: Record<string, { name: string; quantity: number; amount: number }> = {};

    const itemRows = await db
      .select({
        productId: orderItems.productId,
        itemName: orderItems.name,
        categoryName: categories.name,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(inArray(orderItems.orderId, orderIds));

    for (const item of itemRows) {
      const cat = item.categoryName ?? "Senza categoria";
      if (!byCategory[cat]) byCategory[cat] = { quantity: 0, amount: 0 };
      byCategory[cat].quantity += item.quantity;
      byCategory[cat].amount += item.unitPrice * item.quantity;

      const pid = String(item.productId);
      if (!byProduct[pid]) byProduct[pid] = { name: item.itemName, quantity: 0, amount: 0 };
      byProduct[pid].quantity += item.quantity;
      byProduct[pid].amount += item.unitPrice * item.quantity;
    }

    const topProducts = Object.values(byProduct)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return reply.send({
      shift: shiftMeta,
      summary: {
        totalSales,
        totalOrders,
        cancelledOrders: cancelledOrders.length,
        avgTicket,
        refundTotal,
        netSales: totalSales - refundTotal,
      },
      byPaymentMethod: Object.entries(byPaymentMethod).map(([method, v]) => ({ method, ...v })),
      byCategory: Object.entries(byCategory).map(([categoryName, v]) => ({ categoryName, ...v })),
      topProducts,
    });
  });

  // GET /api/stats/shift/:shiftId/full — full breakdown (payment, category, production center, hour, top products)
  fastify.get("/stats/shift/:shiftId/full", {
    schema: {
      tags: ["stats"],
      summary: "Full stats breakdown for a shift, including hourly and production center data",
      querystring: {
        type: "object",
        properties: { terminalId: { type: "number" } },
      },
    },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const { terminalId } = request.query as { terminalId?: number };
    const stats = await getShiftFullStats(fastify.ctx.db, parseInt(shiftId, 10), terminalId);
    if (!stats) return reply.status(404).send({ error: "Shift not found" });
    return reply.send(stats);
  });

  // POST /api/stats/shift/:shiftId/print — print the full shift report on the receipt printer
  fastify.post("/stats/shift/:shiftId/print", {
    schema: {
      tags: ["stats"],
      summary: "Print the full shift report",
      body: {},
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" }, message: { type: "string" } } },
        404: { type: "object", properties: { error: { type: "string" } } },
        503: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const { db, printerService } = fastify.ctx;

    const stats = await getShiftFullStats(db, parseInt(shiftId, 10));
    if (!stats) return reply.status(404).send({ error: "Shift not found" });

    const terminalIdHeader = request.headers["x-terminal-id"] as string | undefined;
    const terminalId = terminalIdHeader !== undefined ? parseInt(terminalIdHeader, 10) : null;

    const activePrinters = await db.select().from(printers).where(eq(printers.active, true));

    let receiptPrinter = activePrinters.find((p) => p.receiptEnabled);

    // Prefer the printer assigned to this terminal (if any)
    if (terminalId) {
      const tpRows = await db.select({ printerId: terminalPrinters.printerId })
        .from(terminalPrinters)
        .where(eq(terminalPrinters.terminalId, terminalId));
      if (tpRows.length > 0) {
        const tpIds = new Set(tpRows.map((r) => r.printerId));
        const terminalReceiptPrinter = activePrinters.find((p) => tpIds.has(p.id) && p.receiptEnabled);
        if (terminalReceiptPrinter) receiptPrinter = terminalReceiptPrinter;
      }
    }

    if (!receiptPrinter) return reply.status(503).send({ error: "No active receipt printer" });

    const [activeTemplate] = await db.select().from(shiftReportTemplates).where(eq(shiftReportTemplates.active, true));
    const useImageMode = activeTemplate?.printMode === "image" && !!activeTemplate?.blocks;

    let content: string | undefined;
    let contentBuffer: Buffer | undefined;

    if (useImageMode) {
      const blocks: ShiftReportBlock[] = typeof activeTemplate!.blocks === "string"
        ? JSON.parse(activeTemplate!.blocks!)
        : activeTemplate!.blocks!;

      const restRows = await db.select().from(appSettings).where(inArray(appSettings.key, [...RESTAURANT_KEYS]));
      const rMap = Object.fromEntries(restRows.map((r) => [r.key, r.value]));
      const rawLogo = activeTemplate!.logoPath ?? rMap["restaurant_logo_path"];
      const absLogo = rawLogo ? resolve(join(fastify.ctx.config.dataDir, rawLogo)) : null;
      const logoPath = (absLogo && existsSync(absLogo)) ? absLogo : null;

      const pngBuffer = await renderShiftReportImage({
        blocks,
        canvasWidth: activeTemplate!.canvasWidth ?? 576,
        logoPath,
        restaurantName: rMap["restaurant_name"] ?? "",
        restaurantAddress: rMap["restaurant_address"] ?? "",
        restaurantCity: rMap["restaurant_city"] ?? "",
        restaurantVat: rMap["restaurant_vat"] ?? "",
        restaurantPhone: rMap["restaurant_phone"] ?? "",
        shift: stats.shift,
        kpis: stats.summary,
        byHour: stats.byHour.filter((h) => h.orders > 0),
        byCategory: stats.byCategory,
        byProductionCenter: stats.byProductionCenter,
        byPaymentMethod: stats.byPaymentMethod,
        byTerminal: stats.byTerminal,
        topProducts: stats.topProducts,
      });
      contentBuffer = await pngToEscposRaster(pngBuffer, activeTemplate!.canvasWidth ?? 576);
    } else {
      content = formatReceipt(buildShiftReportLines(stats));
    }

    const statsRpCfg =
      receiptPrinter.connectionType === "usb" && receiptPrinter.usbVendorId && receiptPrinter.usbProductId
        ? { connectionType: "usb" as const, usbVendorId: receiptPrinter.usbVendorId, usbProductId: receiptPrinter.usbProductId }
        : receiptPrinter.connectionType === "windows" && receiptPrinter.winPrinterName
          ? { connectionType: "windows" as const, winPrinterName: receiptPrinter.winPrinterName }
          : receiptPrinter.host && receiptPrinter.port
            ? { connectionType: "network" as const, host: receiptPrinter.host, port: receiptPrinter.port }
            : undefined;
    const result = await printerService.printDirect({
      printerId: receiptPrinter.id,
      ...(contentBuffer ? { contentBuffer } : { content: content! }),
      type: "receipt",
      ...(statsRpCfg ? { printerConfig: statsRpCfg } : {}),
    });

    return reply.send({ ok: result.success, message: result.message });
  });
};

export default statsRoutes;
