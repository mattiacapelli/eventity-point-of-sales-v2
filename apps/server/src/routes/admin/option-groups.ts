import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, asc } from "@pos/db";
import { optionGroups, options } from "@pos/db";
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

const optionGroupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // ── Option Groups ────────────────────────────────────────────────────────────

  // GET /option-groups — readable by any authenticated user (needed to configure a product in the sales screen)
  fastify.get("/option-groups", {
    schema: { tags: ["option-groups"], summary: "List option groups for a product (with options)" },
  }, async (request, reply) => {
    const { productId } = request.query as { productId?: string };
    if (!productId) return reply.status(400).send({ error: "productId required" });

    const groups = await fastify.ctx.db
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.productId, productId))
      .orderBy(asc(optionGroups.sortOrder));

    const opts = await fastify.ctx.db
      .select()
      .from(options)
      .orderBy(asc(options.sortOrder));

    const result = groups.map((g) => ({
      id: g.id,
      productId: g.productId,
      name: g.name,
      type: g.type,
      required: g.required,
      minSel: g.minSel,
      maxSel: g.maxSel,
      sortOrder: g.sortOrder,
      options: opts
        .filter((o) => o.optionGroupId === g.id)
        .map((o) => ({
          id: o.id,
          optionGroupId: o.optionGroupId,
          name: o.name,
          priceDelta: o.priceDelta,
          prefix: o.prefix ?? "+",
          active: o.active,
          sortOrder: o.sortOrder,
        })),
    }));

    return reply.send(result);
  });

  fastify.post("/option-groups", {
    schema: { tags: ["option-groups"], summary: "Create an option group" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as {
      productId: string;
      name: string;
      type: "single" | "multi" | "removal";
      required?: boolean;
      minSel?: number;
      maxSel?: number;
      sortOrder?: number;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(optionGroups).values({
      id,
      productId: body.productId,
      name: body.name,
      type: body.type,
      required: body.required ?? false,
      minSel: body.minSel ?? 0,
      maxSel: body.maxSel ?? 1,
      sortOrder: body.sortOrder ?? 0,
    });
    const [row] = await fastify.ctx.db.select().from(optionGroups).where(eq(optionGroups.id, id));
    return reply.status(201).send({ ...row, options: [] });
  });

  fastify.patch("/option-groups/:id", {
    schema: { tags: ["option-groups"], summary: "Update an option group" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      type: "single" | "multi" | "removal";
      required: boolean;
      minSel: number;
      maxSel: number;
      sortOrder: number;
    }>;

    const [existing] = await fastify.ctx.db.select().from(optionGroups).where(eq(optionGroups.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      type?: "single" | "multi" | "removal";
      required?: boolean;
      minSel?: number;
      maxSel?: number;
      sortOrder?: number;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.required !== undefined) update.required = body.required;
    if (body.minSel !== undefined) update.minSel = body.minSel;
    if (body.maxSel !== undefined) update.maxSel = body.maxSel;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(optionGroups).set(update).where(eq(optionGroups.id, id));
    }

    const [row] = await fastify.ctx.db.select().from(optionGroups).where(eq(optionGroups.id, id));
    const groupOptions = await fastify.ctx.db
      .select()
      .from(options)
      .where(eq(options.optionGroupId, id))
      .orderBy(asc(options.sortOrder));

    return reply.send({ ...row, options: groupOptions });
  });

  fastify.delete("/option-groups/:id", {
    schema: { tags: ["option-groups"], summary: "Delete an option group (cascades options)" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(optionGroups).where(eq(optionGroups.id, id));
    return reply.status(204).send();
  });

  // ── Options ──────────────────────────────────────────────────────────────────

  fastify.post("/option-groups/:groupId/options", {
    schema: { tags: ["option-groups"], summary: "Create an option inside a group" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const body = request.body as {
      name: string;
      priceDelta?: number;
      prefix?: "+" | "-" | ">>";
      sortOrder?: number;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(options).values({
      id,
      optionGroupId: groupId,
      name: body.name,
      priceDelta: body.priceDelta ?? 0,
      prefix: body.prefix ?? "+",
      active: true,
      sortOrder: body.sortOrder ?? 0,
    });
    const [row] = await fastify.ctx.db.select().from(options).where(eq(options.id, id));
    if (!row) return reply.status(500).send({ error: "Insert failed" });
    return reply.status(201).send({ ...row, prefix: row.prefix ?? "+" });
  });

  fastify.patch("/options/:optionId", {
    schema: { tags: ["option-groups"], summary: "Update an option" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { optionId } = request.params as { optionId: string };
    const body = request.body as Partial<{
      name: string;
      priceDelta: number;
      prefix: "+" | "-" | ">>";
      active: boolean;
      sortOrder: number;
    }>;

    const [existing] = await fastify.ctx.db.select().from(options).where(eq(options.id, optionId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      priceDelta?: number;
      prefix?: string;
      active?: boolean;
      sortOrder?: number;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.priceDelta !== undefined) update.priceDelta = body.priceDelta;
    if (body.prefix !== undefined) update.prefix = body.prefix;
    if (body.active !== undefined) update.active = body.active;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(options).set(update).where(eq(options.id, optionId));
    }

    const [row] = await fastify.ctx.db.select().from(options).where(eq(options.id, optionId));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send({ ...row, prefix: row.prefix ?? "+" });
  });

  fastify.delete("/options/:optionId", {
    schema: { tags: ["option-groups"], summary: "Delete an option" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { optionId } = request.params as { optionId: string };
    await fastify.ctx.db.delete(options).where(eq(options.id, optionId));
    return reply.status(204).send();
  });
};

export default optionGroupsRoutes;
