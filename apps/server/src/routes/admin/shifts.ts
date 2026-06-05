import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, desc, and, isNull, count, inArray } from "@pos/db";
import { shifts, orders } from "@pos/db";
import { randomUUID } from "node:crypto";
import { requireRole, AuthError } from "@pos/core";

const shiftsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin", "cashier");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/shifts/current", {
    schema: { tags: ["shifts"], summary: "Get the current open shift" },
  }, async (request, reply) => {
    const userId = (request as { userId?: string }).userId;
    let query = fastify.ctx.db.select().from(shifts).where(isNull(shifts.closedAt));
    const rows = await query;
    const row = userId ? rows.find((s) => s.userId === userId) : rows[0];
    if (!row) return reply.status(404).send({ error: "No open shift" });
    return reply.send(row);
  });

  fastify.get("/shifts/history", {
    schema: { tags: ["shifts"], summary: "List closed shifts (most recent first)" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db
      .select()
      .from(shifts)
      .orderBy(desc(shifts.openedAt));
    return reply.send(rows);
  });

  fastify.post("/shifts/open", {
    schema: { tags: ["shifts"], summary: "Open a new shift" },
  }, async (request, reply) => {
    const body = request.body as {
      userId: string;
      openingCash?: number;
      notes?: string;
    };

    // Check if there's already an open shift for this user
    const existing = await fastify.ctx.db
      .select()
      .from(shifts)
      .where(and(eq(shifts.userId, body.userId), isNull(shifts.closedAt)));
    if (existing.length > 0) {
      return reply.status(409).send({ error: "User already has an open shift", shift: existing[0] });
    }

    const id = randomUUID();
    await fastify.ctx.db.insert(shifts).values({
      id,
      userId:      body.userId,
      openedAt:    Date.now(),
      openingCash: body.openingCash ?? 0,
      totalSales:  0,
      totalOrders: 0,
      notes:       body.notes ?? null,
    });
    const [row] = await fastify.ctx.db.select().from(shifts).where(eq(shifts.id, id));
    return reply.status(201).send(row);
  });

  fastify.post("/shifts/:id/close", {
    schema: { tags: ["shifts"], summary: "Close a shift" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { force, ...bodyRest } = request.body as {
      closingCash?: number;
      notes?: string;
      force?: boolean;
    };
    const body = bodyRest;

    const [existing] = await fastify.ctx.db.select().from(shifts).where(eq(shifts.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.closedAt !== null) return reply.status(409).send({ error: "Shift already closed" });

    if (!force) {
      const countRows = await fastify.ctx.db
        .select({ pendingCount: count() })
        .from(orders)
        .where(and(eq(orders.shiftId, id), inArray(orders.status, ["pending", "preparing"])));
      const pendingCount = countRows[0]?.pendingCount ?? 0;
      if (pendingCount > 0) {
        return reply.status(409).send({ error: `Ci sono ${pendingCount} ordini ancora attivi. Usa force=true per forzare la chiusura.`, pendingCount });
      }
    }

    await fastify.ctx.db.update(shifts).set({
      closedAt:    Date.now(),
      closingCash: body.closingCash ?? null,
      notes:       body.notes ?? existing.notes ?? null,
    }).where(eq(shifts.id, id));

    const [row] = await fastify.ctx.db.select().from(shifts).where(eq(shifts.id, id));
    return reply.send(row);
  });

  fastify.patch("/shifts/:id", {
    schema: { tags: ["shifts"], summary: "Update shift totals (called after each order)" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      totalSales?: number;
      totalOrders?: number;
    };

    const [existing] = await fastify.ctx.db.select().from(shifts).where(eq(shifts.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: { totalSales?: number; totalOrders?: number } = {};
    if (body.totalSales !== undefined) update.totalSales = body.totalSales;
    if (body.totalOrders !== undefined) update.totalOrders = body.totalOrders;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(shifts).set(update).where(eq(shifts.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(shifts).where(eq(shifts.id, id));
    return reply.send(row);
  });
};

export default shiftsRoutes;
