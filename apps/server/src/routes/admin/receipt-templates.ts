import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "@pos/db";
import { receiptTemplates } from "@pos/db";
import { randomUUID } from "node:crypto";
import { requireRole, AuthError } from "@pos/core";

const receiptTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
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

  fastify.get("/receipt-templates", {
    schema: { tags: ["receipt-templates"], summary: "List receipt templates" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(receiptTemplates);
    return reply.send(rows);
  });

  fastify.get("/receipt-templates/active", {
    schema: { tags: ["receipt-templates"], summary: "Get the active receipt template" },
  }, async (_request, reply) => {
    const [row] = await fastify.ctx.db
      .select()
      .from(receiptTemplates)
      .where(eq(receiptTemplates.active, true));
    if (!row) return reply.status(404).send({ error: "No active template" });
    return reply.send(row);
  });

  fastify.post("/receipt-templates", {
    schema: { tags: ["receipt-templates"], summary: "Create a receipt template" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      headerText?: string;
      footerText?: string;
      showLogo?: boolean;
      showOrderNumber?: boolean;
      showTimestamp?: boolean;
      showPaymentMethod?: boolean;
      active?: boolean;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(receiptTemplates).values({
      id,
      name:              body.name,
      headerText:        body.headerText ?? null,
      footerText:        body.footerText ?? null,
      showLogo:          body.showLogo ?? false,
      showOrderNumber:   body.showOrderNumber ?? true,
      showTimestamp:     body.showTimestamp ?? true,
      showPaymentMethod: body.showPaymentMethod ?? true,
      active:            body.active ?? false,
    });
    const [row] = await fastify.ctx.db.select().from(receiptTemplates).where(eq(receiptTemplates.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/receipt-templates/:id", {
    schema: { tags: ["receipt-templates"], summary: "Update a receipt template" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      headerText: string | null;
      footerText: string | null;
      showLogo: boolean;
      showOrderNumber: boolean;
      showTimestamp: boolean;
      showPaymentMethod: boolean;
      active: boolean;
    }>;

    const [existing] = await fastify.ctx.db.select().from(receiptTemplates).where(eq(receiptTemplates.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      headerText?: string | null;
      footerText?: string | null;
      showLogo?: boolean;
      showOrderNumber?: boolean;
      showTimestamp?: boolean;
      showPaymentMethod?: boolean;
      active?: boolean;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if ("headerText" in body) update.headerText = body.headerText ?? null;
    if ("footerText" in body) update.footerText = body.footerText ?? null;
    if (body.showLogo !== undefined) update.showLogo = body.showLogo;
    if (body.showOrderNumber !== undefined) update.showOrderNumber = body.showOrderNumber;
    if (body.showTimestamp !== undefined) update.showTimestamp = body.showTimestamp;
    if (body.showPaymentMethod !== undefined) update.showPaymentMethod = body.showPaymentMethod;
    if (body.active !== undefined) update.active = body.active;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(receiptTemplates).set(update).where(eq(receiptTemplates.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(receiptTemplates).where(eq(receiptTemplates.id, id));
    return reply.send(row);
  });
};

export default receiptTemplatesRoutes;
