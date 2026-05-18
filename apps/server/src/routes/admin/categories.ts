import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "@pos/db";
import { categories } from "@pos/db";
import { randomUUID } from "node:crypto";

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
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
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      color?: string;
      sortOrder?: number;
      active?: boolean;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(categories).values({
      id,
      name:      body.name,
      color:     body.color ?? null,
      sortOrder: body.sortOrder ?? 0,
      active:    body.active ?? true,
    });
    const [row] = await fastify.ctx.db.select().from(categories).where(eq(categories.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/categories/:id", {
    schema: { tags: ["categories"], summary: "Update a category" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      color: string | null;
      sortOrder: number;
      active: boolean;
    }>;
    const update: {
      name?: string;
      color?: string | null;
      sortOrder?: number;
      active?: boolean;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("color" in body) update.color = body.color ?? null;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (body.active !== undefined) update.active = body.active;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(categories).set(update).where(eq(categories.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(categories).where(eq(categories.id, id));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send(row);
  });

  fastify.delete("/categories/:id", {
    schema: { tags: ["categories"], summary: "Delete a category" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(categories).where(eq(categories.id, id));
    return reply.status(204).send();
  });
};

export default categoriesRoutes;
