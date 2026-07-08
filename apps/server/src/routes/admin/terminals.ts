import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, inArray, terminals, terminalPrinters, terminalCategories, printers, categories } from "@pos/db";
import { randomUUID } from "node:crypto";
import { requireRole, AuthError } from "@pos/core";
import type { Terminal } from "@pos/shared-types";

function toTerminal(row: { id: string; name: string; active: boolean | number; createdAt: number; lastSeenAt: number | null; defaultViewMode: string | null }): Terminal {
  return {
    id: row.id,
    name: row.name,
    active: row.active === true || row.active === 1,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt ?? null,
    defaultViewMode: row.defaultViewMode ?? null,
  };
}

async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireRole(request.session!, "admin");
  } catch (err) {
    if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
    throw err;
  }
}

const terminalsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /admin/terminals — readable by any authenticated user (needed to pick a terminal at login)
  fastify.get("/admin/terminals", {
    schema: { tags: ["terminals"], summary: "List all terminals" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(terminals);
    return reply.send(rows.map(toTerminal));
  });

  // POST /admin/terminals
  fastify.post("/admin/terminals", {
    schema: { tags: ["terminals"], summary: "Create a terminal" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as { name: string };
    if (!body.name?.trim()) return reply.status(400).send({ error: "name is required" });
    const id = randomUUID();
    const now = Date.now();
    await fastify.ctx.db.insert(terminals).values({ id, name: body.name.trim(), active: true, createdAt: now, lastSeenAt: null });
    const [row] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    fastify.ctx.eventBus.emit("TERMINAL_CREATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(201).send(toTerminal(row!));
  });

  // PATCH /admin/terminals/:id
  fastify.patch("/admin/terminals/:id", {
    schema: { tags: ["terminals"], summary: "Update a terminal" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{ name: string; active: boolean; defaultViewMode: string | null }>;
    const [existing] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: Partial<{ name: string; active: boolean; defaultViewMode: string | null }> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.active !== undefined) update.active = body.active;
    if (body.defaultViewMode !== undefined) update.defaultViewMode = body.defaultViewMode;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(terminals).set(update).where(eq(terminals.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    fastify.ctx.eventBus.emit("TERMINAL_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.send(toTerminal(row!));
  });

  // DELETE /admin/terminals/:id
  fastify.delete("/admin/terminals/:id", {
    schema: { tags: ["terminals"], summary: "Delete a terminal" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(terminalPrinters).where(eq(terminalPrinters.terminalId, id));
    await fastify.ctx.db.delete(terminals).where(eq(terminals.id, id));
    fastify.ctx.eventBus.emit("TERMINAL_DELETED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(204).send();
  });

  // GET /admin/terminals/:id/printers
  fastify.get("/admin/terminals/:id/printers", {
    schema: { tags: ["terminals"], summary: "List printers assigned to a terminal" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tpRows = await fastify.ctx.db.select().from(terminalPrinters).where(eq(terminalPrinters.terminalId, id));
    if (tpRows.length === 0) return reply.send([]);
    const printerIds = tpRows.map((r) => r.printerId);
    const rows = await fastify.ctx.db.select().from(printers).where(inArray(printers.id, printerIds));
    return reply.send(rows);
  });

  // POST /admin/terminals/:id/printers/:printerId
  fastify.post("/admin/terminals/:id/printers/:printerId", {
    schema: { tags: ["terminals"], summary: "Assign a printer to a terminal" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    const [terminal] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    if (!terminal) return reply.status(404).send({ error: "Terminal not found" });
    const [printer] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, printerId));
    if (!printer) return reply.status(404).send({ error: "Printer not found" });

    const [existing] = await fastify.ctx.db.select().from(terminalPrinters)
      .where(and(eq(terminalPrinters.terminalId, id), eq(terminalPrinters.printerId, printerId)));
    if (!existing) {
      await fastify.ctx.db.insert(terminalPrinters).values({ terminalId: id, printerId });
    }
    return reply.status(204).send();
  });

  // DELETE /admin/terminals/:id/printers/:printerId
  fastify.delete("/admin/terminals/:id/printers/:printerId", {
    schema: { tags: ["terminals"], summary: "Remove a printer from a terminal" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    await fastify.ctx.db.delete(terminalPrinters)
      .where(and(eq(terminalPrinters.terminalId, id), eq(terminalPrinters.printerId, printerId)));
    return reply.status(204).send();
  });

  // GET /admin/terminals/:id/categories
  fastify.get("/admin/terminals/:id/categories", {
    schema: { tags: ["terminals"], summary: "List categories visible on a terminal, ordered" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tcRows = await fastify.ctx.db.select().from(terminalCategories)
      .where(eq(terminalCategories.terminalId, id))
      .orderBy(terminalCategories.sortOrder);
    if (tcRows.length === 0) return reply.send([]);
    const categoryIds = tcRows.map((r) => r.categoryId);
    const rows = await fastify.ctx.db.select().from(categories).where(inArray(categories.id, categoryIds));
    const byId = Object.fromEntries(rows.map((c) => [c.id, c]));
    return reply.send(tcRows.map((r) => byId[r.categoryId]).filter(Boolean));
  });

  // POST /admin/terminals/:id/categories/:categoryId
  fastify.post("/admin/terminals/:id/categories/:categoryId", {
    schema: { tags: ["terminals"], summary: "Add a category to a terminal's visible list" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, categoryId } = request.params as { id: string; categoryId: string };
    const [terminal] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    if (!terminal) return reply.status(404).send({ error: "Terminal not found" });
    const [category] = await fastify.ctx.db.select().from(categories).where(eq(categories.id, categoryId));
    if (!category) return reply.status(404).send({ error: "Category not found" });

    const [existing] = await fastify.ctx.db.select().from(terminalCategories)
      .where(and(eq(terminalCategories.terminalId, id), eq(terminalCategories.categoryId, categoryId)));
    if (!existing) {
      const current = await fastify.ctx.db.select().from(terminalCategories).where(eq(terminalCategories.terminalId, id));
      await fastify.ctx.db.insert(terminalCategories).values({ terminalId: id, categoryId, sortOrder: current.length });
    }
    return reply.status(204).send();
  });

  // DELETE /admin/terminals/:id/categories/:categoryId
  fastify.delete("/admin/terminals/:id/categories/:categoryId", {
    schema: { tags: ["terminals"], summary: "Remove a category from a terminal's visible list" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, categoryId } = request.params as { id: string; categoryId: string };
    await fastify.ctx.db.delete(terminalCategories)
      .where(and(eq(terminalCategories.terminalId, id), eq(terminalCategories.categoryId, categoryId)));
    return reply.status(204).send();
  });

  // PATCH /admin/terminals/:id/categories/reorder
  fastify.patch("/admin/terminals/:id/categories/reorder", {
    schema: { tags: ["terminals"], summary: "Reorder a terminal's visible categories" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { categoryIds } = request.body as { categoryIds: string[] };
    for (let i = 0; i < categoryIds.length; i++) {
      await fastify.ctx.db.update(terminalCategories)
        .set({ sortOrder: i })
        .where(and(eq(terminalCategories.terminalId, id), eq(terminalCategories.categoryId, categoryIds[i]!)));
    }
    return reply.status(204).send();
  });

  // POST /admin/terminals/:id/heartbeat
  fastify.post("/admin/terminals/:id/heartbeat", {
    schema: { tags: ["terminals"], summary: "Update terminal last seen timestamp" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    if (!existing) return reply.status(404).send({ error: "Terminal not found" });
    await fastify.ctx.db.update(terminals).set({ lastSeenAt: Date.now() }).where(eq(terminals.id, id));
    const [row] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    return reply.send(toTerminal(row!));
  });
};

export default terminalsRoutes;
