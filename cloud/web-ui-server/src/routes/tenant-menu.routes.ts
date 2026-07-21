import type { FastifyPluginAsync } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, categories, products, optionGroups, options } from "../db/client.js";
import { menuSyncBodySchema, applyMenuSync } from "../core/menu-sync.js";

async function resolveTenantBySlug(db: DbClient, slug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  return tenant ?? null;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// availableDates is a JSON array of "YYYY-MM-DD" strings, cloud-only (see menu-sync.ts).
// null/empty means "always visible".
function isAvailableToday(availableDates: string | null, today: string): boolean {
  if (!availableDates) return true;
  try {
    const dates = JSON.parse(availableDates) as unknown;
    if (!Array.isArray(dates) || dates.length === 0) return true;
    return dates.includes(today);
  } catch {
    return true;
  }
}

const tenantMenuRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  // GET /api/tenants/:slug/menu — public, read by the web-ui
  fastify.get("/api/tenants/:slug/menu", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const tenant = await resolveTenantBySlug(db, slug);
    if (!tenant || !tenant.active) return reply.status(404).send({ error: "Tenant not found or inactive" });

    const categoryRows = await db.select().from(categories).where(eq(categories.tenantId, tenant.id));
    const today = todayIso();
    const productRows = (await db.select().from(products).where(and(eq(products.tenantId, tenant.id), eq(products.active, true))))
      .filter((p) => isAvailableToday(p.availableDates, today));
    const groupRows = await db.select().from(optionGroups).where(eq(optionGroups.tenantId, tenant.id));
    const optionRows = await db.select().from(options).where(and(eq(options.tenantId, tenant.id), eq(options.active, true)));

    const optionsByGroup = new Map<number, typeof optionRows>();
    for (const o of optionRows) {
      const arr = optionsByGroup.get(o.optionGroupId) ?? [];
      arr.push(o);
      optionsByGroup.set(o.optionGroupId, arr);
    }
    const groupsByProduct = new Map<number, (typeof groupRows[number] & { options: typeof optionRows })[]>();
    for (const g of groupRows.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const arr = groupsByProduct.get(g.productId) ?? [];
      arr.push({ ...g, options: (optionsByGroup.get(g.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder) });
      groupsByProduct.set(g.productId, arr);
    }

    return reply.send({
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        logoUrl: tenant.logoPath ? `/api/static/${tenant.logoPath}` : null,
        colorBrand: tenant.colorBrand,
        colorAccent: tenant.colorAccent,
        requireTableId: tenant.requireTableId,
        requireCustomerName: tenant.requireCustomerName,
      },
      categories: categoryRows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
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
    if (typeof apiKey !== "string" || !timingSafeEqualStrings(apiKey, tenant.apiKey)) {
      return reply.status(401).send({ error: "Invalid tenant key" });
    }

    const parsed = menuSyncBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    // Preserve the till's own ids so a scanned order (which embeds the till's product/option ids)
    // can be matched back against the local catalogue — never regenerate them.
    // Wrapped in a single transaction: readers never observe an empty/partial catalogue mid-sync,
    // and two concurrent syncs for the same tenant can no longer interleave their delete/insert steps.
    const result = applyMenuSync(db, tenant.id, parsed.data);

    return reply.send({ ok: true, ...result });
  });
};

export default tenantMenuRoutes;
