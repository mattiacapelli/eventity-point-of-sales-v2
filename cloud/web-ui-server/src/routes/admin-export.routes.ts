import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { orders, tenants } from "../db/client.js";
import { requireAuth, requireTenantRole, requireSuperAdmin } from "../auth/authorize.js";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n");
}

const adminExportRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.get(
    "/admin/tenants/:id/orders/export.csv",
    { onRequest: [requireTenantRole(db, "operator")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.tenantId, tenantId))
        .orderBy(desc(orders.createdAt));

      const csv = toCsv(
        ["id", "orderCode", "tableId", "customerName", "totalAmount", "createdAt"],
        rows.map((o) => [
          o.id,
          o.orderCode,
          o.tableId,
          o.customerName ?? "",
          o.totalAmount,
          new Date(o.createdAt).toISOString(),
        ]),
      );

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="orders-${tenantId}.csv"`)
        .send(csv);
    },
  );

  fastify.get(
    "/admin/tenants/export.csv",
    { onRequest: [requireSuperAdmin()] },
    async (_request, reply) => {
      const rows = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          active: tenants.active,
          createdAt: tenants.createdAt,
          ordersCount: sql<number>`(select count(*) from ${orders} where ${orders.tenantId} = ${tenants.id})`,
          totalRevenue: sql<number>`(select coalesce(sum(${orders.totalAmount}), 0) from ${orders} where ${orders.tenantId} = ${tenants.id})`,
        })
        .from(tenants);

      const csv = toCsv(
        ["id", "slug", "name", "active", "createdAt", "ordersCount", "totalRevenue"],
        rows.map((t) => [
          t.id,
          t.slug,
          t.name,
          t.active,
          new Date(t.createdAt).toISOString(),
          t.ordersCount,
          t.totalRevenue,
        ]),
      );

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", 'attachment; filename="tenants.csv"')
        .send(csv);
    },
  );
};

export default adminExportRoutes;
