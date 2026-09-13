import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { and, eq, dailyExtras } from "@pos/db";

const dailyExtrasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /daily-extras?date=YYYY-MM-DD
  fastify.get("/daily-extras", {
    schema: { tags: ["daily-extras"], summary: "List extra products for a date" },
  }, async (request, reply) => {
    const { date } = request.query as { date?: string };
    if (!date) return reply.status(400).send({ error: "date query param required (YYYY-MM-DD)" });

    const rows = await fastify.ctx.db
      .select({ productId: dailyExtras.productId, date: dailyExtras.date })
      .from(dailyExtras)
      .where(eq(dailyExtras.date, date));

    return reply.send(rows);
  });

  // POST /daily-extras — { productId, date }
  fastify.post("/daily-extras", {
    schema: { tags: ["daily-extras"], summary: "Add a product as extra for a date" },
  }, async (request, reply) => {
    const { productId, date } = request.body as { productId: number; date: string };
    if (!productId || !date) return reply.status(400).send({ error: "productId and date required" });

    await fastify.ctx.db
      .insert(dailyExtras)
      .values({ productId, date, createdAt: Date.now() })
      .onConflictDoNothing();

    return reply.status(201).send({ productId, date });
  });

  // DELETE /daily-extras/:productId/:date
  fastify.delete("/daily-extras/:productId/:date", {
    schema: { tags: ["daily-extras"], summary: "Remove a product extra for a date" },
  }, async (request, reply) => {
    const { productId, date } = request.params as { productId: string; date: string };
    await fastify.ctx.db
      .delete(dailyExtras)
      .where(and(eq(dailyExtras.productId, parseInt(productId, 10)), eq(dailyExtras.date, date)));

    return reply.status(204).send();
  });
};

export default dailyExtrasRoutes;
