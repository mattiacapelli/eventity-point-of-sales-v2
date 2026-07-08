import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, products, optionGroups, options, orders } from "../db/client.js";
import { encodeQrPayload } from "../core/qr-payload.js";

interface OrderItemInput {
  productId: string;
  quantity: number;
  selectedOptionIds?: string[];
}

function generateOrderCode(): string {
  const letters = Math.random().toString(36).slice(2, 6).toUpperCase();
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${letters}-${digits}`;
}

const tenantOrdersRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/tenants/:slug/orders — creates the order and returns the compressed QR payload
  fastify.post("/api/tenants/:slug/orders", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    if (!tenant || !tenant.active) return reply.status(404).send({ error: "Tenant not found or inactive" });

    const body = request.body as { tableId: string; customerName?: string; items: OrderItemInput[] };
    if (!body.tableId?.trim()) return reply.status(400).send({ error: "tableId is required" });
    if (body.tableId.trim().length > 20) return reply.status(400).send({ error: "tableId is too long (max 20 characters)" });
    if (body.customerName && body.customerName.trim().length > 100) {
      return reply.status(400).send({ error: "customerName is too long (max 100 characters)" });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) return reply.status(400).send({ error: "items[] must not be empty" });
    if (body.items.length > 100) return reply.status(400).send({ error: "Too many items (max 100)" });

    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const productRows = await db.select().from(products).where(and(eq(products.tenantId, tenant.id), eq(products.active, true)));
    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length > 0) return reply.status(400).send({ error: `Unknown product ids: ${missing.join(", ")}` });

    // Load option groups/options for the involved products — never trust price/name from the client.
    const groupRows = await db.select().from(optionGroups).where(
      and(eq(optionGroups.tenantId, tenant.id), inArray(optionGroups.productId, productIds))
    );
    const groupsByProduct = new Map<string, typeof groupRows>();
    for (const g of groupRows) {
      const arr = groupsByProduct.get(g.productId) ?? [];
      arr.push(g);
      groupsByProduct.set(g.productId, arr);
    }
    const groupIds = groupRows.map((g) => g.id);
    const optionRows = groupIds.length > 0
      ? await db.select().from(options).where(and(eq(options.tenantId, tenant.id), inArray(options.optionGroupId, groupIds)))
      : [];
    const optionMap = new Map(optionRows.map((o) => [o.id, o]));

    for (const item of body.items) {
      const requiredGroups = (groupsByProduct.get(item.productId) ?? []).filter((g) => g.required);
      if (requiredGroups.length === 0) continue;
      const selectedIds = new Set(item.selectedOptionIds ?? []);
      for (const group of requiredGroups) {
        const hasSelection = optionRows.some((o) => o.optionGroupId === group.id && selectedIds.has(o.id));
        if (!hasSelection) {
          return reply.status(400).send({ error: `Product ${item.productId} is missing a required selection for "${group.name}"` });
        }
      }
    }

    // Rich snapshot kept in the DB for the admin dashboard (readable order history).
    const detailedItems = body.items.map((i) => {
      const product = productMap.get(i.productId)!;
      const selectedOptions = (i.selectedOptionIds ?? [])
        .map((oid) => optionMap.get(oid))
        .filter((o): o is NonNullable<typeof o> => o !== undefined)
        .map((o) => ({ optionId: o.id, name: o.name, priceDelta: o.priceDelta, prefix: o.prefix }));
      const optionsDelta = selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0);
      return {
        productId: product.id,
        name: product.name,
        price: product.price + optionsDelta,
        quantity: i.quantity,
        ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
      };
    });
    const total = detailedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const id = randomUUID();
    const orderCode = generateOrderCode();
    const customerName = body.customerName?.trim() || null;

    await db.insert(orders).values({
      id,
      tenantId: tenant.id,
      orderCode,
      tableId: body.tableId.trim(),
      customerName,
      itemsJson: JSON.stringify(detailedItems),
      totalAmount: total,
      createdAt: Date.now(),
    });

    // Compact payload embedded in the QR: only ids/quantities — the till resolves
    // name/price/options from its own local catalogue when the code is scanned.
    const qrPayload = encodeQrPayload({
      v: 1,
      code: orderCode,
      tableId: body.tableId.trim(),
      customerName,
      items: body.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        ...(i.selectedOptionIds && i.selectedOptionIds.length > 0 ? { selectedOptionIds: i.selectedOptionIds } : {}),
      })),
    });

    return reply.status(201).send({
      orderCode,
      total,
      qrPayload,
    });
  });
};

export default tenantOrdersRoutes;
