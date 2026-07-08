import type { FastifyPluginAsync } from "fastify";
import { randomUUID, randomBytes } from "node:crypto";
import { eq, desc, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, categories, products, orders } from "../db/client.js";

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

  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });

  fastify.get("/admin/tenants", async (_request, reply) => {
    const rows = await db.select().from(tenants);
    return reply.send(rows);
  });

  fastify.post("/admin/tenants", async (request, reply) => {
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

    const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/admin/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{ name: string; active: boolean }>;

    const [existing] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: { name?: string; active?: boolean } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.active !== undefined) update.active = body.active;

    if (Object.keys(update).length > 0) {
      await db.update(tenants).set(update).where(eq(tenants.id, id));
    }
    const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
    return reply.send(row);
  });

  fastify.get("/admin/tenants/:id/stats", async (request, reply) => {
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
  });

  fastify.post("/admin/tenants/:id/rotate-key", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const apiKey = generateApiKey();
    await db.update(tenants).set({ apiKey }).where(eq(tenants.id, id));
    return reply.send({ apiKey });
  });

  fastify.delete("/admin/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(tenants).where(eq(tenants.id, id));
    return reply.status(204).send();
  });
};

export default adminTenantsRoutes;
