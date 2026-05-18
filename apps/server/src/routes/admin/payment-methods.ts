import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "@pos/db";
import { paymentMethods } from "@pos/db";
import { randomUUID } from "node:crypto";

const paymentMethodsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/payment-methods", {
    schema: { tags: ["payment-methods"], summary: "List all payment methods" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db
      .select()
      .from(paymentMethods)
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
    return reply.send(rows);
  });

  fastify.post("/payment-methods", {
    schema: { tags: ["payment-methods"], summary: "Create a payment method" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      type: string;
      active?: boolean;
      sortOrder?: number;
      icon?: string;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(paymentMethods).values({
      id,
      name:      body.name,
      type:      body.type,
      active:    body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
      icon:      body.icon ?? null,
    });
    const [row] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/payment-methods/:id", {
    schema: { tags: ["payment-methods"], summary: "Update a payment method" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      type: string;
      active: boolean;
      sortOrder: number;
      icon: string | null;
    }>;

    const [existing] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      type?: string;
      active?: boolean;
      sortOrder?: number;
      icon?: string | null;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.active !== undefined) update.active = body.active;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if ("icon" in body) update.icon = body.icon ?? null;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(paymentMethods).set(update).where(eq(paymentMethods.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.send(row);
  });

  fastify.delete("/payment-methods/:id", {
    schema: { tags: ["payment-methods"], summary: "Delete a payment method" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.status(204).send();
  });
};

export default paymentMethodsRoutes;
