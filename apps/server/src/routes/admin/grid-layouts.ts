import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, productGridLayouts } from "@pos/db";
import { AuthError, requireRole } from "@pos/core";
import type { ProductGridSlot } from "@pos/shared-types";

const gridLayoutsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin", "cashier");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/admin/grid-layouts/:scope", {
    schema: { tags: ["admin"], summary: "Get grid layout for a scope" },
  }, async (request, reply) => {
    const { scope } = request.params as { scope: string };
    const rows = await fastify.ctx.db
      .select()
      .from(productGridLayouts)
      .where(eq(productGridLayouts.scope, scope));

    const slots: ProductGridSlot[] = rows.map((r) => ({
      productId: r.productId,
      slotX: r.slotX,
      slotY: r.slotY,
      spanW: r.spanW,
      spanH: r.spanH,
    }));
    return reply.send(slots);
  });

  fastify.post("/admin/grid-layouts/:scope", {
    schema: { tags: ["admin"], summary: "Save grid layout for a scope (replaces existing)" },
  }, async (request, reply) => {
    const { scope } = request.params as { scope: string };
    const slots = request.body as ProductGridSlot[];

    const db = fastify.ctx.db;
    await db.delete(productGridLayouts).where(eq(productGridLayouts.scope, scope));

    if (slots.length > 0) {
      await db.insert(productGridLayouts).values(
        slots.map((s) => ({
          scope,
          productId: s.productId,
          slotX: s.slotX,
          slotY: s.slotY,
          spanW: s.spanW,
          spanH: s.spanH,
        }))
      );
    }

    return reply.status(204).send();
  });
};

export default gridLayoutsRoutes;
