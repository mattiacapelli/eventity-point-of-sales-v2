import type { FastifyPluginAsync } from "fastify";
import { randomUUID, randomBytes } from "node:crypto";
import { eq, desc, sql, like, inArray } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, categories, products, orders, tenantUsers } from "../db/client.js";
import { requireAuth, requireTenantRole, requireSuperAdmin, writeAuditLog } from "../auth/authorize.js";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || randomUUID().slice(0, 8);
}

function generateApiKey(): string {
  return randomBytes(24).toString("base64url");
}

const adminTenantsRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.get("/admin/tenants", async (request, reply) => {
    const { search, page: pageRaw, pageSize: pageSizeRaw } = request.query as {
      search?: string;
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeRaw ?? 20) || 20));

    const currentUser = request.currentUser!;
    let allowedTenantIds: string[] | null = null;
    if (!currentUser.isSuperAdmin) {
      const memberships = await db.select().from(tenantUsers).where(eq(tenantUsers.userId, currentUser.id));
      allowedTenantIds = memberships.map((m) => m.tenantId);
      if (allowedTenantIds.length === 0) {
        return reply.send({ items: [], total: 0, page, pageSize });
      }
    }

    const conditions = [];
    if (allowedTenantIds) conditions.push(inArray(tenants.id, allowedTenantIds));
    if (search?.trim()) conditions.push(like(tenants.name, `%${search.trim()}%`));

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

    const rows = await db
      .select()
      .from(tenants)
      .where(whereClause)
      .orderBy(desc(tenants.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(whereClause);

    return reply.send({ items: rows, total: count, page, pageSize });
  });

  fastify.post(
    "/admin/tenants",
    { onRequest: [requireSuperAdmin()] },
    async (request, reply) => {
      const body = request.body as { name: string; slug?: string };
      if (!body.name?.trim()) return reply.status(400).send({ error: "name is required" });

      const id = randomUUID();
      const slug = (body.slug?.trim() || generateSlug(body.name));

      const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug));
      if (existing) return reply.status(409).send({ error: "Slug already in use" });

      await db.insert(tenants).values({
        id,
        slug,
        name: body.name.trim(),
        apiKey: generateApiKey(),
        active: true,
        createdAt: Date.now(),
      });

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId: id,
        action: "tenant.create",
        metadata: { name: body.name.trim(), slug },
      });

      const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
      return reply.status(201).send(row);
    },
  );

  fastify.patch(
    "/admin/tenants/:id",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<{ name: string; active: boolean }>;

      const [existing] = await db.select().from(tenants).where(eq(tenants.id, id));
      if (!existing) return reply.status(404).send({ error: "Not found" });

      const update: { name?: string; active?: boolean } = {};
      if (body.name !== undefined) update.name = body.name;
      if (body.active !== undefined) update.active = body.active;

      if (Object.keys(update).length > 0) {
        await db.update(tenants).set(update).where(eq(tenants.id, id));
        await writeAuditLog(db, {
          userId: request.currentUser!.id,
          tenantId: id,
          action: body.active !== undefined ? (body.active ? "tenant.activate" : "tenant.deactivate") : "tenant.update",
          metadata: update,
        });
      }
      const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
      return reply.send(row);
    },
  );

  fastify.get(
    "/admin/tenants/:id/stats",
    { onRequest: [requireTenantRole(db, "operator")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
      if (!tenant) return reply.status(404).send({ error: "Not found" });

      const categoryRows = await db.select().from(categories).where(eq(categories.tenantId, id));
      const productRows = await db.select().from(products).where(eq(products.tenantId, id));
      const [totals] = await db
        .select({ count: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(eq(orders.tenantId, id));
      const recentOrderRows = await db.select().from(orders).where(eq(orders.tenantId, id)).orderBy(desc(orders.createdAt)).limit(20);

      return reply.send({
        categoriesCount: categoryRows.length,
        productsCount: productRows.length,
        ordersCount: totals?.count ?? 0,
        totalRevenue: totals?.revenue ?? 0,
        recentOrders: recentOrderRows.map((o) => ({
          id: o.id,
          orderCode: o.orderCode,
          tableId: o.tableId,
          customerName: o.customerName,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
        })),
      });
    },
  );

  fastify.post(
    "/admin/tenants/:id/rotate-key",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [existing] = await db.select().from(tenants).where(eq(tenants.id, id));
      if (!existing) return reply.status(404).send({ error: "Not found" });

      const apiKey = generateApiKey();
      await db.update(tenants).set({ apiKey }).where(eq(tenants.id, id));
      await writeAuditLog(db, { userId: request.currentUser!.id, tenantId: id, action: "tenant.rotate_key" });
      return reply.send({ apiKey });
    },
  );

  fastify.delete(
    "/admin/tenants/:id",
    { onRequest: [requireSuperAdmin()] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [existing] = await db.select().from(tenants).where(eq(tenants.id, id));
      await db.delete(tenants).where(eq(tenants.id, id));
      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId: null,
        action: "tenant.delete",
        metadata: { tenantId: id, name: existing?.name },
      });
      return reply.status(204).send();
    },
  );
};

export default adminTenantsRoutes;
