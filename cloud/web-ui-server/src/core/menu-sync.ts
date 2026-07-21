import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { categories, products, optionGroups, options } from "../db/client.js";

const idSchema = z.number().int().positive();

const optionSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  priceDelta: z.number().optional(),
  prefix: z.enum(["+", "-", ">>"]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const optionGroupSchema = z.object({
  id: idSchema.optional(),
  productId: idSchema,
  name: z.string().min(1),
  type: z.enum(["single", "multi", "removal"]),
  required: z.boolean().optional(),
  minSel: z.number().optional(),
  maxSel: z.number().optional(),
  sortOrder: z.number().optional(),
  options: z.array(optionSchema),
});

const categorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1),
  sortOrder: z.number().optional(),
});

const productSchema = z.object({
  id: idSchema.optional(),
  categoryId: idSchema,
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
// by the caller (the till's own integer ids) so references embedded elsewhere (e.g. a
// scanned order's product ids) keep matching; rows without an id get one auto-assigned
// by SQLite's AUTOINCREMENT, inserted one at a time so each can pick up its own id.
export function applyMenuSync(db: DbClient, tenantId: string, body: MenuSyncBody): MenuSyncResult {
  const syncedGroups = body.optionGroups ?? [];

  db.transaction((tx) => {
    // The till has no concept of a category emoji (it's a cloud-only setting) — a sync payload
    // never carries one, so preserve whatever the cloud already had by id across the wipe.
    const existingCategories = tx.select().from(categories).where(eq(categories.tenantId, tenantId)).all();
    const emojiByCategoryId = new Map(existingCategories.map((c) => [c.id, c.emoji]));

    // Same reasoning for products.availableDates — a cloud-only date filter the till knows nothing about.
    const existingProducts = tx.select().from(products).where(eq(products.tenantId, tenantId)).all();
    const availableDatesByProductId = new Map(existingProducts.map((p) => [p.id, p.availableDates]));

    tx.delete(options).where(eq(options.tenantId, tenantId)).run();
    tx.delete(optionGroups).where(eq(optionGroups.tenantId, tenantId)).run();
    tx.delete(products).where(eq(products.tenantId, tenantId)).run();
    tx.delete(categories).where(eq(categories.tenantId, tenantId)).run();

    for (const [i, c] of body.categories.entries()) {
      tx.insert(categories).values({
        ...(c.id !== undefined ? { id: c.id } : {}),
        tenantId,
        name: c.name,
        emoji: c.id !== undefined ? (emojiByCategoryId.get(c.id) ?? null) : null,
        sortOrder: c.sortOrder ?? i,
      }).run();
    }

    for (const [i, p] of body.products.entries()) {
      tx.insert(products).values({
        ...(p.id !== undefined ? { id: p.id } : {}),
        tenantId,
        categoryId: p.categoryId,
        name: p.name,
        price: p.price,
        active: p.active ?? true,
        sortOrder: p.sortOrder ?? i,
        availableDates: p.id !== undefined ? (availableDatesByProductId.get(p.id) ?? null) : null,
      }).run();
    }

    for (const [gi, g] of syncedGroups.entries()) {
      const groupResult = tx.insert(optionGroups).values({
        ...(g.id !== undefined ? { id: g.id } : {}),
        tenantId,
        productId: g.productId,
        name: g.name,
        type: g.type,
        required: g.required ?? false,
        minSel: g.minSel ?? 0,
        maxSel: g.maxSel ?? 1,
        sortOrder: g.sortOrder ?? gi,
      }).run();
      const groupId = g.id ?? Number(groupResult.lastInsertRowid);

      for (const [oi, o] of g.options.entries()) {
        tx.insert(options).values({
          ...(o.id !== undefined ? { id: o.id } : {}),
          tenantId,
          optionGroupId: groupId,
          name: o.name,
          priceDelta: o.priceDelta ?? 0,
          prefix: o.prefix ?? (g.type === "removal" ? "-" : "+"),
          active: o.active ?? true,
          sortOrder: o.sortOrder ?? oi,
        }).run();
      }
    }
  });

  return {
    categories: body.categories.length,
    products: body.products.length,
    optionGroups: syncedGroups.length,
  };
}
