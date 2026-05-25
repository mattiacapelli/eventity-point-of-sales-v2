import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, and, inArray, terminals, terminalPrinters, printers } from "@pos/db";
import { randomUUID } from "node:crypto";
import { requireRole, AuthError } from "@pos/core";
import type { Terminal } from "@pos/shared-types";

function toTerminal(row: { id: string; name: string; active: boolean | number; createdAt: number; lastSeenAt: number | null }): Terminal {
  return {
    id: row.id,
    name: row.name,
    active: row.active === true || row.active === 1,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt ?? null,
  };
}

const terminalsRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /admin/terminals
  fastify.get("/admin/terminals", {
    schema: { tags: ["terminals"], summary: "List all terminals" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(terminals);
    return reply.send(rows.map(toTerminal));
  });

  // POST /admin/terminals
  fastify.post("/admin/terminals", {
    schema: { tags: ["terminals"], summary: "Create a terminal" },
  }, async (request, reply) => {
    const body = request.body as { name: string };
    if (!body.name?.trim()) return reply.status(400).send({ error: "name is required" });
    const id = randomUUID();
    const now = Date.now();
    await fastify.ctx.db.insert(terminals).values({ id, name: body.name.trim(), active: true, createdAt: now, lastSeenAt: null });
    const [row] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    return reply.status(201).send(toTerminal(row!));
  });

  // PATCH /admin/terminals/:id
  fastify.patch("/admin/terminals/:id", {
    schema: { tags: ["terminals"], summary: "Update a terminal" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{ name: string; active: boolean }>;
    const [existing] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: Partial<{ name: string; active: boolean }> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.active !== undefined) update.active = body.active;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(terminals).set(update).where(eq(terminals.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(terminals).where(eq(terminals.id, id));
    return reply.send(toTerminal(row!));
  });

  // DELETE /admin/terminals/:id
  fastify.delete("/admin/terminals/:id", {
    schema: { tags: ["terminals"], summary: "Delete a terminal" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(terminalPrinters).where(eq(terminalPrinters.terminalId, id));
    await fastify.ctx.db.delete(terminals).where(eq(terminals.id, id));
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
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    await fastify.ctx.db.delete(terminalPrinters)
      .where(and(eq(terminalPrinters.terminalId, id), eq(terminalPrinters.printerId, printerId)));
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
