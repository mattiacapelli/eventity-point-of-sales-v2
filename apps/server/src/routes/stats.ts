import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte, inArray, orders, orderItems, products, categories, payments, shifts } from "@pos/db";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, _reply) => {
    await fastify.authenticate(request);
  });

  // GET /api/stats/shift/:shiftId
  fastify.get("/stats/shift/:shiftId", {
    schema: { tags: ["stats"], summary: "Stats for a specific shift" },
  }, async (request, reply) => {
    const { shiftId } = request.params as { shiftId: string };
    const db = fastify.ctx.db;

    const completedOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shiftId, shiftId), eq(orders.status, "completed")));

    const orderIds = completedOrders.map((o) => o.id);
    const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = completedOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    const byPaymentMethod: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    if (orderIds.length > 0) {
      const pmtRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
      for (const p of pmtRows) {
        byPaymentMethod[p.method] = (byPaymentMethod[p.method] ?? 0) + p.amount;
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

  // GET /api/stats/period?from=&to=
  fastify.get("/stats/period", {
    schema: {
      tags: ["stats"],
      summary: "Stats for a time period",
      querystring: {
        type: "object",
        required: ["from", "to"],
        properties: {
          from: { type: "number" },
          to:   { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const { from, to } = request.query as { from: number; to: number };
    const db = fastify.ctx.db;

    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "completed"),
          gte(orders.createdAt, new Date(from)),
          lte(orders.createdAt, new Date(to)),
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
    const db = fastify.ctx.db;

    const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    if (!shift) return reply.status(404).send({ error: "Shift not found" });

    const shiftOrders = await db.select().from(orders).where(eq(orders.shiftId, shiftId));

    const completedOrders = shiftOrders.filter((o) => o.status === "completed");
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

    const pmtRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
    for (const p of pmtRows) {
      if (p.status === "completed") {
        const entry = byPaymentMethod[p.method] ?? { count: 0, amount: 0 };
        entry.count++;
        entry.amount += p.amount;
        byPaymentMethod[p.method] = entry;
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

      const pid = item.productId;
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
};

export default statsRoutes;
