import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "@pos/db";
import { productionCenters, productionCenterCategories, categories } from "@pos/db";
import { randomUUID } from "node:crypto";

const productionCentersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/production-centers", {
    schema: { tags: ["production-centers"], summary: "List all production centers" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color })
      .from(productionCenters);
    return reply.send(rows);
  });

  fastify.post("/production-centers", {
    schema: { tags: ["production-centers"], summary: "Create a production center" },
  }, async (request, reply) => {
    const body = request.body as { name: string; color?: string };
    const id = randomUUID();
    await fastify.ctx.db.insert(productionCenters).values({
      id,
      name: body.name,
      color: body.color ?? null,
    });
    const [row] = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color })
      .from(productionCenters)
      .where(eq(productionCenters.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Update a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; color?: string | null };

    const [existing] = await fastify.ctx.db.select().from(productionCenters).where(eq(productionCenters.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: { name?: string; color?: string | null } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("color" in body) update.color = body.color ?? null;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(productionCenters).set(update).where(eq(productionCenters.id, id));
    }

    const [row] = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color })
      .from(productionCenters)
      .where(eq(productionCenters.id, id));
    return reply.send(row);
  });

  fastify.delete("/production-centers/:id", {
    schema: { tags: ["production-centers"], summary: "Delete a production center" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(productionCenters).where(eq(productionCenters.id, id));
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
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { categoryId: string };
    await fastify.ctx.db
      .insert(productionCenterCategories)
      .values({ productionCenterId: id, categoryId: body.categoryId });
    return reply.status(201).send();
  });

  fastify.delete("/production-centers/:id/categories/:categoryId", {
    schema: { tags: ["production-centers"], summary: "Remove a category from a production center" },
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
    return reply.status(204).send();
  });
};

export default productionCentersRoutes;
