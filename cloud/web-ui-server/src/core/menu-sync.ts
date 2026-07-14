import { randomUUID } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { categories, products, optionGroups, options } from "../db/client.js";

const optionSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  priceDelta: z.number().optional(),
  prefix: z.enum(["+", "-", ">>"]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const optionGroupSchema = z.object({
  id: z.string().min(1).optional(),
  productId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["single", "multi", "removal"]),
  required: z.boolean().optional(),
  minSel: z.number().optional(),
  maxSel: z.number().optional(),
  sortOrder: z.number().optional(),
  options: z.array(optionSchema),
});

const categorySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  sortOrder: z.number().optional(),
});

const productSchema = z.object({
  id: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  name: z.string().min(1),
  price: z.number(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const menuSyncBodySchema = z.object({
  categories: z.array(categorySchema),
  products: z.array(productSchema),
  optionGroups: z.array(optionGroupSchema).optional(),
});

export type MenuSyncBody = z.infer<typeof menuSyncBodySchema>;

export interface MenuSyncResult {
  categories: number;
  products: number;
  optionGroups: number;
}

// Wipes and recreates the tenant's full catalogue atomically. Preserves ids provided
// by the caller so references embedded elsewhere (e.g. a scanned order's product ids)
// keep matching; only missing ids get a fresh randomUUID().
export function applyMenuSync(db: DbClient, tenantId: string, body: MenuSyncBody): MenuSyncResult {
  const syncedGroups = body.optionGroups ?? [];

  db.transaction((tx) => {
    tx.delete(options).where(eq(options.tenantId, tenantId)).run();
    tx.delete(optionGroups).where(eq(optionGroups.tenantId, tenantId)).run();
    tx.delete(products).where(eq(products.tenantId, tenantId)).run();
    tx.delete(categories).where(eq(categories.tenantId, tenantId)).run();

    if (body.categories.length > 0) {
      const categoryRows = body.categories.map((c, i) => ({
        id: c.id ?? randomUUID(),
        tenantId,
        name: c.name,
        sortOrder: c.sortOrder ?? i,
      }));
      tx.insert(categories).values(categoryRows).run();
    }

    if (body.products.length > 0) {
      const productRows = body.products.map((p, i) => ({
        id: p.id ?? randomUUID(),
        tenantId,
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
        tenantId,
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
          tenantId,
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

  return {
    categories: body.categories.length,
    products: body.products.length,
    optionGroups: syncedGroups.length,
  };
}
