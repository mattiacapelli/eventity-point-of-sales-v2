import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { desc, gte, lte, and, eq } from "@pos/db";
import { printLog } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

const printLogRoutes: FastifyPluginAsync = async (fastify) => {
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

  fastify.get("/admin/print-log", {
    schema: {
      tags: ["print-log"],
      summary: "Print job log — every queued/rendering/sent/ok/retry/failed event",
      querystring: {
        type: "object",
        properties: {
          from:      { type: "number", description: "Unix ms start" },
          to:        { type: "number", description: "Unix ms end" },
          orderId:   { type: "number" },
          jobType:   { type: "string", enum: ["kitchen", "receipt"] },
          event:     { type: "string", enum: ["queued","rendering","sent","ok","retry","failed","offline_fast_fail"] },
          printerId: { type: "number" },
          limit:     { type: "number", default: 200 },
          offset:    { type: "number", default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as {
      from?: number;
      to?: number;
      orderId?: number;
      jobType?: "kitchen" | "receipt";
      event?: "queued" | "rendering" | "sent" | "ok" | "retry" | "failed" | "offline_fast_fail";
      printerId?: number;
      limit?: number;
      offset?: number;
    };

    const db = fastify.ctx.db;
    const limit  = Math.min(q.limit ?? 200, 1000);
    const offset = q.offset ?? 0;

    // Build filter list dynamically; each pushed item has a compatible return type
    const conditions = [
      q.from      !== undefined ? gte(printLog.ts, new Date(q.from)) : null,
      q.to        !== undefined ? lte(printLog.ts, new Date(q.to))   : null,
      q.orderId   !== undefined ? eq(printLog.orderId,   q.orderId)   : null,
      q.jobType   !== undefined ? eq(printLog.jobType,   q.jobType)   : null,
      q.printerId !== undefined ? eq(printLog.printerId, q.printerId) : null,
      q.event     !== undefined ? eq(printLog.event,     q.event)     : null,
    ].filter(Boolean);

    const rows = await db
      .select()
      .from(printLog)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(conditions.length > 0 ? and(...(conditions as any)) : undefined)
      .orderBy(desc(printLog.id))
      .limit(limit)
      .offset(offset);

    return reply.send({ rows, limit, offset });
  });
};

export default printLogRoutes;
