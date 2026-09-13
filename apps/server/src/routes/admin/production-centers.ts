import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, asc } from "@pos/db";
import { productionCenters, productionCenterCategories, productionCenterPrinters, categories, printers } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireRole(request.session!, "admin");
  } catch (err) {
    if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
    throw err;
  }
}

const productionCentersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /production-centers — readable by any authenticated user (needed to group products in the sales screen)
  fastify.get("/production-centers", {
    schema: { tags: ["production-centers"], summary: "List all production centers" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color, icon: productionCenters.icon, receiptPrintMode: productionCenters.receiptPrintMode, sortOrder: productionCenters.sortOrder })
      .from(productionCenters)
      .orderBy(asc(productionCenters.sortOrder), asc(productionCenters.name));
    return reply.send(rows);
  });

  fastify.post("/production-centers", {
    schema: { tags: ["production-centers"], summary: "Create a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as { name: string; color?: string; icon?: string | null; receiptPrintMode?: "included" | "separate"; sortOrder?: number };
    const [row] = await fastify.ctx.db.insert(productionCenters).values({
      name: body.name,
      color: body.color ?? null,
      icon: body.icon ?? null,
      receiptPrintMode: body.receiptPrintMode ?? "included",
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_CREATED", { traceId: crypto.randomUUID(), id: row!.id, timestamp: new Date() });
    return reply.status(201).send(row);
  });

  fastify.patch("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Update a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as { name?: string; color?: string | null; icon?: string | null; receiptPrintMode?: "included" | "separate"; sortOrder?: number };

    const [existing] = await fastify.ctx.db.select().from(productionCenters).where(eq(productionCenters.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: { name?: string; color?: string | null; icon?: string | null; receiptPrintMode?: "included" | "separate"; sortOrder?: number } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("color" in body) update.color = body.color ?? null;
    if ("icon" in body) update.icon = body.icon ?? null;
    if (body.receiptPrintMode !== undefined) update.receiptPrintMode = body.receiptPrintMode;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(productionCenters).set(update).where(eq(productionCenters.id, numId));
    }

    const [row] = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color, icon: productionCenters.icon, receiptPrintMode: productionCenters.receiptPrintMode, sortOrder: productionCenters.sortOrder })
      .from(productionCenters)
      .where(eq(productionCenters.id, numId));
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.send(row);
  });

  fastify.delete("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Delete a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    await fastify.ctx.db.delete(productionCenters).where(eq(productionCenters.id, numId));
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_DELETED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });

  fastify.put("/production-centers/reorder", {
    schema: { tags: ["production-centers"], summary: "Reorder production centers" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { ids } = request.body as { ids: string[] };
    for (let i = 0; i < ids.length; i++) {
      await fastify.ctx.db.update(productionCenters).set({ sortOrder: i }).where(eq(productionCenters.id, parseInt(ids[i]!, 10)));
    }
    return reply.status(204).send();
  });

  fastify.get("/production-centers/:id/categories", {
    schema: { tags: ["production-centers"], summary: "List categories assigned to a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const rows = await fastify.ctx.db
      .select({ id: categories.id, name: categories.name })
      .from(productionCenterCategories)
      .innerJoin(categories, eq(productionCenterCategories.categoryId, categories.id))
      .where(eq(productionCenterCategories.productionCenterId, numId));
    return reply.send(rows);
  });

  fastify.post("/production-centers/:id/categories", {
    schema: { tags: ["production-centers"], summary: "Assign a category to a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as { categoryId: number | string };
    const numCategoryId = typeof body.categoryId === "string" ? parseInt(body.categoryId, 10) : body.categoryId;
    await fastify.ctx.db
      .insert(productionCenterCategories)
      .values({ productionCenterId: numId, categoryId: numCategoryId });
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(201).send();
  });

  fastify.delete("/production-centers/:id/categories/:categoryId", {
    schema: { tags: ["production-centers"], summary: "Remove a category from a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, categoryId } = request.params as { id: string; categoryId: string };
    const numId = parseInt(id, 10);
    const numCategoryId = parseInt(categoryId, 10);
    await fastify.ctx.db
      .delete(productionCenterCategories)
      .where(
        and(
          eq(productionCenterCategories.productionCenterId, numId),
          eq(productionCenterCategories.categoryId, numCategoryId),
        ),
      );
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });

  fastify.get("/production-centers/:id/printers", {
    schema: { tags: ["production-centers"], summary: "List printers assigned to a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const rows = await fastify.ctx.db
      .select({ id: printers.id, name: printers.name, host: printers.host, port: printers.port, kitchenEnabled: printers.kitchenEnabled, active: printers.active })
      .from(productionCenterPrinters)
      .innerJoin(printers, eq(productionCenterPrinters.printerId, printers.id))
      .where(eq(productionCenterPrinters.productionCenterId, numId));
    return reply.send(rows);
  });

  fastify.post("/production-centers/:id/printers/:printerId", {
    schema: { tags: ["production-centers"], summary: "Assign a printer to a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    const numId = parseInt(id, 10);
    const numPrinterId = parseInt(printerId, 10);
    await fastify.ctx.db
      .insert(productionCenterPrinters)
      .values({ productionCenterId: numId, printerId: numPrinterId })
      .onConflictDoNothing();
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(201).send();
  });

  fastify.delete("/production-centers/:id/printers/:printerId", {
    schema: { tags: ["production-centers"], summary: "Remove a printer from a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    const numId = parseInt(id, 10);
    const numPrinterId = parseInt(printerId, 10);
    await fastify.ctx.db
      .delete(productionCenterPrinters)
      .where(
        and(
          eq(productionCenterPrinters.productionCenterId, numId),
          eq(productionCenterPrinters.printerId, numPrinterId),
        ),
      );
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });
};

export default productionCentersRoutes;
