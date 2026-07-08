import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { auditLog } from "../db/client.js";
import { requireAuth, requireTenantRole, requireSuperAdmin } from "../auth/authorize.js";

function paginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query["page"] ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query["pageSize"] ?? 20) || 20));
  return { page, pageSize };
}

const adminAuditRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.get(
    "/admin/tenants/:id/audit-log",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const { page, pageSize } = paginationParams(request.query as Record<string, unknown>);

      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.tenantId, tenantId))
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLog)
        .where(eq(auditLog.tenantId, tenantId));

      return reply.send({ items: rows, total: count, page, pageSize });
    },
  );

  fastify.get(
    "/admin/audit-log",
    { onRequest: [requireSuperAdmin()] },
    async (request, reply) => {
      const { page, pageSize } = paginationParams(request.query as Record<string, unknown>);

      const rows = await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)` }).from(auditLog);

      return reply.send({ items: rows, total: count, page, pageSize });
    },
  );
};

export default adminAuditRoutes;
