import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql, like } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { users, tenantUsers, tenants } from "../db/client.js";
import { requireAuth, requireSuperAdmin } from "../auth/authorize.js";

const adminGlobalUsersRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));
  fastify.addHook("onRequest", requireSuperAdmin());

  // GET /admin/users — list all users in the system with their tenant memberships.
  fastify.get("/admin/users", async (request, reply) => {
    const { search, page: pageRaw, pageSize: pageSizeRaw } = request.query as {
      search?: string;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw ?? 20) || 20));

    const whereClause = search?.trim() ? like(users.email, `%${search.trim()}%`) : undefined;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        isSuperAdmin: users.isSuperAdmin,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const userIds = rows.map((u) => u.id);
    const memberships = userIds.length > 0
      ? await db
          .select({
            userId: tenantUsers.userId,
            tenantId: tenantUsers.tenantId,
            tenantName: tenants.name,
            tenantSlug: tenants.slug,
            role: tenantUsers.role,
          })
          .from(tenantUsers)
          .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
          .where(sql`${tenantUsers.userId} IN ${userIds}`)
      : [];

    const membershipsByUser = new Map<string, typeof memberships>();
    for (const m of memberships) {
      const arr = membershipsByUser.get(m.userId) ?? [];
      arr.push(m);
      membershipsByUser.set(m.userId, arr);
    }

    const items = rows.map((u) => ({
      ...u,
      tenants: (membershipsByUser.get(u.id) ?? []).map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenantName,
        tenantSlug: m.tenantSlug,
        role: m.role,
      })),
    }));

    return reply.send({ items, total: count, page, pageSize });
  });
};

export default adminGlobalUsersRoutes;
