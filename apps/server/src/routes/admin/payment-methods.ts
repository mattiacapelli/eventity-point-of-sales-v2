import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, asc } from "@pos/db";
import { paymentMethods } from "@pos/db";
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

const paymentMethodsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /payment-methods — readable by any authenticated user (needed at checkout)
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
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      type: string;
      active?: boolean;
      sortOrder?: number;
      icon?: string;
      excludeFromTotal?: boolean;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(paymentMethods).values({
      id,
      name:             body.name,
      type:             body.type,
      active:           body.active ?? true,
      sortOrder:        body.sortOrder ?? 0,
      icon:             body.icon ?? null,
      excludeFromTotal: body.excludeFromTotal ?? false,
    });
    const [row] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/payment-methods/:id", {
    schema: { tags: ["payment-methods"], summary: "Update a payment method" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      type: string;
      active: boolean;
      sortOrder: number;
      icon: string | null;
      excludeFromTotal: boolean;
    }>;

    const [existing] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      type?: string;
      active?: boolean;
      sortOrder?: number;
      icon?: string | null;
      excludeFromTotal?: boolean;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.active !== undefined) update.active = body.active;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if ("icon" in body) update.icon = body.icon ?? null;
    if (body.excludeFromTotal !== undefined) update.excludeFromTotal = body.excludeFromTotal;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(paymentMethods).set(update).where(eq(paymentMethods.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.send(row);
  });

  fastify.delete("/payment-methods/:id", {
    schema: { tags: ["payment-methods"], summary: "Delete a payment method" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(paymentMethods).where(eq(paymentMethods.id, id));
    return reply.status(204).send();
  });
};

export default paymentMethodsRoutes;
