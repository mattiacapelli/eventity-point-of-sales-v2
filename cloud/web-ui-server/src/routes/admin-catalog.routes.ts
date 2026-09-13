import type { FastifyPluginAsync } from "fastify";
import { existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants, categories, products } from "../db/client.js";
import { requireAuth, requireTenantRole, writeAuditLog } from "../auth/authorize.js";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};
const IMAGE_EXTS = [".png", ".jpg", ".webp"];

const reorderBodySchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

const renameBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const emojiBodySchema = z.object({
  emoji: z.string().trim().max(8).nullable(),
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const availabilityBodySchema = z.object({
  availableDates: z.array(isoDateSchema).nullable(),
});

function serializeProduct<T extends { availableDates: string | null }>(p: T) {
  let availableDates: string[] | null = null;
  if (p.availableDates) {
    try {
      const parsed = JSON.parse(p.availableDates) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) availableDates = parsed as string[];
    } catch { /* malformed, treat as always-visible */ }
  }
  return { ...p, availableDates };
}

const adminCatalogRoutes: FastifyPluginAsync<{ db: DbClient; dataDir: string }> = async (fastify, opts) => {
  const { db, dataDir } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.get(
    "/admin/tenants/:id/categories",
    { onRequest: [requireTenantRole(db, "operator")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const rows = await db.select().from(categories).where(eq(categories.tenantId, tenantId));
      return reply.send(rows.sort((a, b) => a.sortOrder - b.sortOrder));
    },
  );

  fastify.patch(
    "/admin/tenants/:id/categories/reorder",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = reorderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const { order } = parsed.data;

      const existing = await db.select().from(categories).where(eq(categories.tenantId, tenantId));
      const existingIds = new Set(existing.map((c) => c.id));

      if (order.length !== existing.length || !order.every((id) => existingIds.has(id))) {
        return reply.status(400).send({ error: "order must contain exactly the tenant's existing category ids" });
      }

      db.transaction((tx) => {
        order.forEach((categoryId, index) => {
          tx.update(categories)
            .set({ sortOrder: index })
            .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
            .run();
        });
      });

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "category.reorder",
        metadata: { order },
      });

      return reply.send({ ok: true });
    },
  );

  fastify.patch(
    "/admin/tenants/:id/categories/:categoryId/emoji",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, categoryId: categoryIdParam } = request.params as { id: string; categoryId: string };
      const categoryId = Number(categoryIdParam);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return reply.status(400).send({ error: "Invalid category id" });
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = emojiBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const [category] = await db.select().from(categories).where(
        and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)),
      );
      if (!category) return reply.status(404).send({ error: "Category not found" });

      const emoji = parsed.data.emoji?.trim() || null;
      await db.update(categories)
        .set({ emoji })
        .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)));

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "category.emoji_update",
        metadata: { categoryId, emoji },
      });

      const [updated] = await db.select().from(categories).where(eq(categories.id, categoryId));
      return reply.send(updated);
    },
  );

  fastify.get(
    "/admin/tenants/:id/products",
    { onRequest: [requireTenantRole(db, "operator")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const rows = await db.select().from(products).where(eq(products.tenantId, tenantId));
      return reply.send(rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serializeProduct));
    },
  );

  fastify.patch(
    "/admin/tenants/:id/products/:productId/availability",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, productId: productIdParam } = request.params as { id: string; productId: string };
      const productId = Number(productIdParam);
      if (!Number.isInteger(productId) || productId <= 0) {
        return reply.status(400).send({ error: "Invalid product id" });
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = availabilityBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const [product] = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      if (!product) return reply.status(404).send({ error: "Product not found" });

      const dates = parsed.data.availableDates;
      const availableDates = dates && dates.length > 0 ? JSON.stringify(dates) : null;
      await db.update(products)
        .set({ availableDates })
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "product.availability_update",
        metadata: { productId, availableDates: dates },
      });

      const [updated] = await db.select().from(products).where(eq(products.id, productId));
      return reply.send(serializeProduct(updated!));
    },
  );

  fastify.post(
    "/admin/tenants/:id/products/:productId/image",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, productId: productIdParam } = request.params as { id: string; productId: string };
      const productId = Number(productIdParam);
      if (!Number.isInteger(productId) || productId <= 0) {
        return reply.status(400).send({ error: "Invalid product id" });
      }

      const [product] = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      if (!product) return reply.status(404).send({ error: "Product not found" });

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "No file uploaded" });

      const ext = IMAGE_MIME_TO_EXT[data.mimetype];
      if (!ext) return reply.status(400).send({ error: "Only PNG/JPG/WEBP allowed" });

      const imagesDir = resolve(dataDir, "images/products");
      const safeFilename = `${productId}${ext}`;
      const relPath = `images/products/${safeFilename}`;
      const absPath = join(imagesDir, safeFilename);

      for (const oldExt of IMAGE_EXTS) {
        const old = join(imagesDir, `${productId}${oldExt}`);
        if (old !== absPath && existsSync(old)) {
          try { unlinkSync(old); } catch { /* ok */ }
        }
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk as Buffer);
      await writeFile(absPath, Buffer.concat(chunks));

      await db.update(products).set({ imagePath: relPath }).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "product.image_upload",
        metadata: { productId, imagePath: relPath },
      });

      const [updated] = await db.select().from(products).where(eq(products.id, productId));
      return reply.send(serializeProduct(updated!));
    },
  );

  fastify.delete(
    "/admin/tenants/:id/products/:productId/image",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, productId: productIdParam } = request.params as { id: string; productId: string };
      const productId = Number(productIdParam);
      if (!Number.isInteger(productId) || productId <= 0) {
        return reply.status(400).send({ error: "Invalid product id" });
      }

      const [product] = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      if (!product) return reply.status(404).send({ error: "Product not found" });

      if (product.imagePath) {
        const absPath = resolve(join(dataDir, product.imagePath));
        if (existsSync(absPath)) {
          try { unlinkSync(absPath); } catch { /* ok */ }
        }
      }

      await db.update(products).set({ imagePath: null }).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "product.image_delete",
        metadata: { productId },
      });

      return reply.status(204).send();
    },
  );

  fastify.patch(
    "/admin/tenants/:id/products/:productId",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, productId: productIdParam } = request.params as { id: string; productId: string };
      const productId = Number(productIdParam);
      if (!Number.isInteger(productId) || productId <= 0) {
        return reply.status(400).send({ error: "Invalid product id" });
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = renameBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const [product] = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      );
      if (!product) return reply.status(404).send({ error: "Product not found" });

      await db.update(products)
        .set({ name: parsed.data.name })
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "product.rename",
        metadata: { productId, oldName: product.name, newName: parsed.data.name },
      });

      const [updated] = await db.select().from(products).where(eq(products.id, productId));
      return reply.send(serializeProduct(updated!));
    },
  );
};

export default adminCatalogRoutes;
