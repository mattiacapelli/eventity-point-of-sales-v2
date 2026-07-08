import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, categories, products, optionGroups, options } from "../db/client.js";

interface SyncCategory {
  id?: string;
  name: string;
  sortOrder?: number;
}

interface SyncOption {
  id?: string;
  name: string;
  priceDelta?: number;
  prefix?: "+" | "-" | ">>";
  active?: boolean;
  sortOrder?: number;
}

interface SyncOptionGroup {
  id?: string;
  productId: string; // references the till's own product id (see SyncProduct.id below)
  name: string;
  type: "single" | "multi" | "removal";
  required?: boolean;
  minSel?: number;
  maxSel?: number;
  sortOrder?: number;
  options: SyncOption[];
}

interface SyncProduct {
  id?: string;
  categoryId: string; // references the `id` given in the categories array above (client-side id)
  name: string;
  price: number;
  active?: boolean;
  sortOrder?: number;
}

async function resolveTenantBySlug(db: DbClient, slug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  return tenant ?? null;
}

const tenantMenuRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  // GET /api/tenants/:slug/menu — public, read by the web-ui
  fastify.get("/api/tenants/:slug/menu", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const tenant = await resolveTenantBySlug(db, slug);
    if (!tenant || !tenant.active) return reply.status(404).send({ error: "Tenant not found or inactive" });

    const categoryRows = await db.select().from(categories).where(eq(categories.tenantId, tenant.id));
    const productRows = await db.select().from(products).where(and(eq(products.tenantId, tenant.id), eq(products.active, true)));
    const groupRows = await db.select().from(optionGroups).where(eq(optionGroups.tenantId, tenant.id));
    const optionRows = await db.select().from(options).where(and(eq(options.tenantId, tenant.id), eq(options.active, true)));

    const optionsByGroup = new Map<string, typeof optionRows>();
    for (const o of optionRows) {
      const arr = optionsByGroup.get(o.optionGroupId) ?? [];
      arr.push(o);
      optionsByGroup.set(o.optionGroupId, arr);
    }
    const groupsByProduct = new Map<string, (typeof groupRows[number] & { options: typeof optionRows })[]>();
    for (const g of groupRows.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const arr = groupsByProduct.get(g.productId) ?? [];
      arr.push({ ...g, options: (optionsByGroup.get(g.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder) });
      groupsByProduct.set(g.productId, arr);
    }

    return reply.send({
      tenant: { slug: tenant.slug, name: tenant.name },
      categories: categoryRows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({ id: c.id, name: c.name })),
      products: productRows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          name: p.name,
          price: p.price,
          optionGroups: (groupsByProduct.get(p.id) ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            type: g.type,
            required: g.required,
            minSel: g.minSel,
            maxSel: g.maxSel,
            options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, prefix: o.prefix })),
          })),
        })),
    });
  });

  // POST /api/tenants/:slug/menu/sync — the till pushes its full menu here; wipes and recreates atomically.
  fastify.post("/api/tenants/:slug/menu/sync", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const tenant = await resolveTenantBySlug(db, slug);
    if (!tenant) return reply.status(404).send({ error: "Tenant not found" });
    if (!tenant.active) return reply.status(403).send({ error: "Tenant is not active" });

    const apiKey = request.headers["x-tenant-key"];
    if (apiKey !== tenant.apiKey) return reply.status(401).send({ error: "Invalid tenant key" });

    const body = request.body as { categories: SyncCategory[]; products: SyncProduct[]; optionGroups?: SyncOptionGroup[] };
    if (!Array.isArray(body.categories) || !Array.isArray(body.products)) {
      return reply.status(400).send({ error: "categories[] and products[] are required" });
    }

    const syncedGroups = body.optionGroups ?? [];

    // Preserve the till's own ids so a scanned order (which embeds the till's product/option ids)
    // can be matched back against the local catalogue — never regenerate them.
    // Wrapped in a single transaction: readers never observe an empty/partial catalogue mid-sync,
    // and two concurrent syncs for the same tenant can no longer interleave their delete/insert steps.
    db.transaction((tx) => {
      tx.delete(options).where(eq(options.tenantId, tenant.id)).run();
      tx.delete(optionGroups).where(eq(optionGroups.tenantId, tenant.id)).run();
      tx.delete(products).where(eq(products.tenantId, tenant.id)).run();
      tx.delete(categories).where(eq(categories.tenantId, tenant.id)).run();

      if (body.categories.length > 0) {
        const categoryRows = body.categories.map((c, i) => ({
          id: c.id ?? randomUUID(),
          tenantId: tenant.id,
          name: c.name,
          sortOrder: c.sortOrder ?? i,
        }));
        tx.insert(categories).values(categoryRows).run();
      }

      if (body.products.length > 0) {
        const productRows = body.products.map((p, i) => ({
          id: p.id ?? randomUUID(),
          tenantId: tenant.id,
          categoryId: p.categoryId,
          name: p.name,
          price: p.price,
          active: p.active ?? true,
          sortOrder: p.sortOrder ?? i,
        }));
        tx.insert(products).values(productRows).run();
      }

      if (syncedGroups.length > 0) {
        const groupRows = syncedGroups.map((g, i) => ({
          id: g.id ?? randomUUID(),
          tenantId: tenant.id,
          productId: g.productId,
          name: g.name,
          type: g.type,
          required: g.required ?? false,
          minSel: g.minSel ?? 0,
          maxSel: g.maxSel ?? 1,
          sortOrder: g.sortOrder ?? i,
        }));
        tx.insert(optionGroups).values(groupRows).run();

        const optionRows = syncedGroups.flatMap((g, gi) =>
          g.options.map((o, oi) => ({
            id: o.id ?? randomUUID(),
            tenantId: tenant.id,
            optionGroupId: groupRows[gi]!.id,
            name: o.name,
            priceDelta: o.priceDelta ?? 0,
            prefix: o.prefix ?? (g.type === "removal" ? "-" : "+"),
            active: o.active ?? true,
            sortOrder: o.sortOrder ?? oi,
          }))
        );
        if (optionRows.length > 0) tx.insert(options).values(optionRows).run();
      }
    });

    return reply.send({ ok: true, categories: body.categories.length, products: body.products.length, optionGroups: syncedGroups.length });
  });
};

export default tenantMenuRoutes;
