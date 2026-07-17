import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, asc } from "@pos/db";
import { categories } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireRole(request.session!, "admin");
  } catch (err) {
    if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
    throw err;
  }
}

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /categories — readable by any authenticated user (needed by the sales screen)
  fastify.get("/categories", {
    schema: { tags: ["categories"], summary: "List all categories" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return reply.send(rows);
  });

  fastify.post("/categories", {
    schema: { tags: ["categories"], summary: "Create a category" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      color?: string;
      sortOrder?: number;
      active?: boolean;
    };
    const [row] = await fastify.ctx.db.insert(categories).values({
      name:      body.name,
      color:     body.color ?? null,
      sortOrder: body.sortOrder ?? 0,
      active:    body.active ?? true,
    }).returning();
    fastify.ctx.eventBus.emit("CATEGORY_CREATED", { traceId: crypto.randomUUID(), id: row!.id, timestamp: new Date() });
    return reply.status(201).send(row);
  });

  fastify.patch("/categories/:id", {
    schema: { tags: ["categories"], summary: "Update a category" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{
      name: string;
      color: string | null;
      sortOrder: number;
      active: boolean;
      receiptPrintMode: string;
    }>;
    const update: {
      name?: string;
      color?: string | null;
      sortOrder?: number;
      active?: boolean;
      receiptPrintMode?: string;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("color" in body) update.color = body.color ?? null;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (body.active !== undefined) update.active = body.active;
    if (body.receiptPrintMode !== undefined) update.receiptPrintMode = body.receiptPrintMode;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(categories).set(update).where(eq(categories.id, numId));
    }
    const [row] = await fastify.ctx.db.select().from(categories).where(eq(categories.id, numId));
    if (!row) return reply.status(404).send({ error: "Not found" });
    fastify.ctx.eventBus.emit("CATEGORY_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.send(row);
  });

  fastify.put("/categories/reorder", {
    schema: { tags: ["categories"], summary: "Reorder categories" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { ids } = request.body as { ids: string[] };
    for (let i = 0; i < ids.length; i++) {
      await fastify.ctx.db.update(categories).set({ sortOrder: i }).where(eq(categories.id, parseInt(ids[i]!, 10)));
    }
    return reply.status(204).send();
  });

  fastify.delete("/categories/:id", {
    schema: { tags: ["categories"], summary: "Delete a category" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    await fastify.ctx.db.delete(categories).where(eq(categories.id, numId));
    fastify.ctx.eventBus.emit("CATEGORY_DELETED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });
};

export default categoriesRoutes;
