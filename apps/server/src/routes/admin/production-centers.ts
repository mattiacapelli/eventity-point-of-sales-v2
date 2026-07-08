import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "@pos/db";
import { productionCenters, productionCenterCategories, productionCenterPrinters, categories, printers } from "@pos/db";
import { randomUUID } from "node:crypto";
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
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color, receiptPrintMode: productionCenters.receiptPrintMode })
      .from(productionCenters);
    return reply.send(rows);
  });

  fastify.post("/production-centers", {
    schema: { tags: ["production-centers"], summary: "Create a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as { name: string; color?: string; receiptPrintMode?: "included" | "separate" };
    const id = randomUUID();
    await fastify.ctx.db.insert(productionCenters).values({
      id,
      name: body.name,
      color: body.color ?? null,
      receiptPrintMode: body.receiptPrintMode ?? "included",
    });
    const [row] = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color, receiptPrintMode: productionCenters.receiptPrintMode })
      .from(productionCenters)
      .where(eq(productionCenters.id, id));
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_CREATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(201).send(row);
  });

  fastify.patch("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Update a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; color?: string | null; receiptPrintMode?: "included" | "separate" };

    const [existing] = await fastify.ctx.db.select().from(productionCenters).where(eq(productionCenters.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: { name?: string; color?: string | null; receiptPrintMode?: "included" | "separate" } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("color" in body) update.color = body.color ?? null;
    if (body.receiptPrintMode !== undefined) update.receiptPrintMode = body.receiptPrintMode;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(productionCenters).set(update).where(eq(productionCenters.id, id));
    }

    const [row] = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color, receiptPrintMode: productionCenters.receiptPrintMode })
      .from(productionCenters)
      .where(eq(productionCenters.id, id));
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.send(row);
  });

  fastify.delete("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Delete a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(productionCenters).where(eq(productionCenters.id, id));
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_DELETED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(204).send();
  });

  fastify.get("/production-centers/:id/categories", {
    schema: { tags: ["production-centers"], summary: "List categories assigned to a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rows = await fastify.ctx.db
      .select({ id: categories.id, name: categories.name })
      .from(productionCenterCategories)
      .innerJoin(categories, eq(productionCenterCategories.categoryId, categories.id))
      .where(eq(productionCenterCategories.productionCenterId, id));
    return reply.send(rows);
  });

  fastify.post("/production-centers/:id/categories", {
    schema: { tags: ["production-centers"], summary: "Assign a category to a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { categoryId: string };
    await fastify.ctx.db
      .insert(productionCenterCategories)
      .values({ productionCenterId: id, categoryId: body.categoryId });
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(201).send();
  });

  fastify.delete("/production-centers/:id/categories/:categoryId", {
    schema: { tags: ["production-centers"], summary: "Remove a category from a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, categoryId } = request.params as { id: string; categoryId: string };
    await fastify.ctx.db
      .delete(productionCenterCategories)
      .where(
        and(
          eq(productionCenterCategories.productionCenterId, id),
          eq(productionCenterCategories.categoryId, categoryId),
        ),
      );
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(204).send();
  });

  fastify.get("/production-centers/:id/printers", {
    schema: { tags: ["production-centers"], summary: "List printers assigned to a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rows = await fastify.ctx.db
      .select({ id: printers.id, name: printers.name, host: printers.host, port: printers.port, kitchenEnabled: printers.kitchenEnabled, active: printers.active })
      .from(productionCenterPrinters)
      .innerJoin(printers, eq(productionCenterPrinters.printerId, printers.id))
      .where(eq(productionCenterPrinters.productionCenterId, id));
    return reply.send(rows);
  });

  fastify.post("/production-centers/:id/printers/:printerId", {
    schema: { tags: ["production-centers"], summary: "Assign a printer to a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    await fastify.ctx.db
      .insert(productionCenterPrinters)
      .values({ productionCenterId: id, printerId })
      .onConflictDoNothing();
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(201).send();
  });

  fastify.delete("/production-centers/:id/printers/:printerId", {
    schema: { tags: ["production-centers"], summary: "Remove a printer from a production center" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id, printerId } = request.params as { id: string; printerId: string };
    await fastify.ctx.db
      .delete(productionCenterPrinters)
      .where(
        and(
          eq(productionCenterPrinters.productionCenterId, id),
          eq(productionCenterPrinters.printerId, printerId),
        ),
      );
    fastify.ctx.eventBus.emit("PRODUCTION_CENTER_UPDATED", { traceId: randomUUID(), id, timestamp: new Date() });
    return reply.status(204).send();
  });
};

export default productionCentersRoutes;
