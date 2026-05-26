import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { desc, eq, gte, lte, inArray, and } from "@pos/db";
import { orders, payments, shifts, users } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

export interface AuditEntry {
  id: string;
  type: "order_created" | "order_completed" | "order_cancelled" | "payment_completed" | "payment_refunded" | "shift_opened" | "shift_closed";
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ts: number;
  meta: Record<string, unknown>;
}

const auditLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/admin/audit-log", {
    schema: {
      tags: ["audit-log"],
      summary: "Get aggregated audit log from orders, payments and shifts",
      querystring: {
        type: "object",
        properties: {
          from:   { type: "number" },
          to:     { type: "number" },
          type:   { type: "string" },
          limit:  { type: "number" },
          offset: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as {
      from?: number;
      to?: number;
      type?: string;
      limit?: number;
      offset?: number;
    };

    const db = fastify.ctx.db;
    const limit = Math.min(q.limit ?? 100, 500);
    const offset = q.offset ?? 0;

    // Load all users for actor name resolution
    const allUsers = await db.select({ id: users.id, name: users.name, username: users.username, role: users.role }).from(users);
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const entries: AuditEntry[] = [];

    const fromMs = q.from ?? 0;
    const toMs   = q.to ?? Date.now();
    const fromDate = new Date(fromMs);
    const toDate   = new Date(toMs);

    const tsOf = (d: Date | number | null): number =>
      d === null ? 0 : d instanceof Date ? d.getTime() : (d as number);

    // ── Orders ────────────────────────────────────────────────────────────────
    if (!q.type || ["order_created", "order_completed", "order_cancelled"].includes(q.type)) {
      const orderRows = await db.select().from(orders)
        .where(and(gte(orders.createdAt, fromDate), lte(orders.createdAt, toDate)))
        .orderBy(desc(orders.createdAt));

      for (const o of orderRows) {
        const createdMs = tsOf(o.createdAt);
        const updatedMs = tsOf(o.updatedAt);

        if (!q.type || q.type === "order_created") {
          if (createdMs >= fromMs && createdMs <= toMs) {
            entries.push({
              id: `order_created:${o.id}`,
              type: "order_created",
              entityId: o.id,
              actorId: null,
              actorName: null,
              actorRole: null,
              ts: createdMs,
              meta: {
                status: o.status,
                totalAmount: o.totalAmount,
                receiptNumber: o.receiptNumber,
                shiftId: o.shiftId,
              },
            });
          }
        }
        if ((!q.type || q.type === "order_completed") && o.status === "completed") {
          if (updatedMs >= fromMs && updatedMs <= toMs) {
            entries.push({
              id: `order_completed:${o.id}`,
              type: "order_completed",
              entityId: o.id,
              actorId: null,
              actorName: null,
              actorRole: null,
              ts: updatedMs,
              meta: {
                totalAmount: o.totalAmount,
                receiptNumber: o.receiptNumber,
                shiftId: o.shiftId,
              },
            });
          }
        }
        if ((!q.type || q.type === "order_cancelled") && o.status === "cancelled") {
          if (updatedMs >= fromMs && updatedMs <= toMs) {
            entries.push({
              id: `order_cancelled:${o.id}`,
              type: "order_cancelled",
              entityId: o.id,
              actorId: null,
              actorName: null,
              actorRole: null,
              ts: updatedMs,
              meta: {
                totalAmount: o.totalAmount,
                shiftId: o.shiftId,
              },
            });
          }
        }
      }
    }

    // ── Payments ──────────────────────────────────────────────────────────────
    if (!q.type || ["payment_completed", "payment_refunded"].includes(q.type)) {
      const statusFilter = q.type === "payment_refunded"
        ? eq(payments.status, "refunded")
        : q.type === "payment_completed"
          ? eq(payments.status, "completed")
          : inArray(payments.status, ["completed", "refunded"]);

      const paymentRows = await db.select().from(payments)
        .where(and(statusFilter, gte(payments.createdAt, fromDate), lte(payments.createdAt, toDate)))
        .orderBy(desc(payments.createdAt));
      for (const p of paymentRows) {
        const createdMs = tsOf(p.createdAt);
        entries.push({
          id: `payment_${p.status}:${p.id}`,
          type: p.status === "refunded" ? "payment_refunded" : "payment_completed",
          entityId: p.id,
          actorId: null,
          actorName: null,
          actorRole: null,
          ts: createdMs,
          meta: {
            orderId: p.orderId,
            method: p.method,
            amount: p.amount,
            currency: p.currency,
            reference: p.reference,
          },
        });
      }
    }

    // ── Shifts ────────────────────────────────────────────────────────────────
    if (!q.type || ["shift_opened", "shift_closed"].includes(q.type)) {
      const shiftRows = await db.select().from(shifts).orderBy(desc(shifts.openedAt));

      for (const s of shiftRows) {
        if (s.openedAt >= fromMs && s.openedAt <= toMs) {
          if (!q.type || q.type === "shift_opened") {
            const actor = userMap.get(s.userId);
            entries.push({
              id: `shift_opened:${s.id}`,
              type: "shift_opened",
              entityId: s.id,
              actorId: s.userId,
              actorName: actor?.name ?? actor?.username ?? null,
              actorRole: actor?.role ?? null,
              ts: s.openedAt,
              meta: { openingCash: s.openingCash },
            });
          }
        }
        if (s.closedAt !== null && s.closedAt >= fromMs && s.closedAt <= toMs) {
          if (!q.type || q.type === "shift_closed") {
            const actor = userMap.get(s.userId);
            entries.push({
              id: `shift_closed:${s.id}`,
              type: "shift_closed",
              entityId: s.id,
              actorId: s.userId,
              actorName: actor?.name ?? actor?.username ?? null,
              actorRole: actor?.role ?? null,
              ts: s.closedAt,
              meta: {
                totalSales: s.totalSales,
                totalOrders: s.totalOrders,
                closingCash: s.closingCash,
                notes: s.notes,
              },
            });
          }
        }
      }
    }

    // Sort all entries by ts desc, then paginate
    entries.sort((a, b) => b.ts - a.ts);
    const page = entries.slice(offset, offset + limit);

    return reply.send({
      entries: page,
      total: entries.length,
      offset,
      limit,
    });
  });
};

export default auditLogRoutes;
