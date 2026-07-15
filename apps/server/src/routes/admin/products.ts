import "@fastify/swagger";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { eq, asc, and, like } from "@pos/db";
import { products, categories } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";
import { mkdirSync, unlinkSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireRole(request.session!, "admin");
  } catch (err) {
    if (err instanceof AuthError) return reply.status(403).send({ error: err.message });
    throw err;
  }
}

const productImagesDir = (dataDir: string) => `${dataDir}/images/products`;

function ensureDir(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

const PRODUCT_SELECT = {
  id:                 products.id,
  name:               products.name,
  price:              products.price,
  categoryId:         products.categoryId,
  categoryName:       categories.name,
  productionCenterId: products.productionCenterId,
  active:             products.active,
  color:              products.color,
  description:        products.description,
  imageData:          products.imageData,
  sortOrder:          products.sortOrder,
  vatRate:            products.vatRate,
  receiptPrintMode:   products.receiptPrintMode,
  availableDates:     products.availableDates,
  createdAt:          products.createdAt,
  updatedAt:          products.updatedAt,
} as const;

function parseAvailableDates(raw: string | null): string[] | null {
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
}

function serializeAvailableDates(dates: string[] | null | undefined): string | null {
  if (!dates || dates.length === 0) return null;
  return JSON.stringify(dates);
}

function mapProductRow<T extends { availableDates: string | null }>(row: T): Omit<T, "availableDates"> & { availableDates: string[] | null } {
  return { ...row, availableDates: parseAvailableDates(row.availableDates) };
}

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  // GET /products — readable by any authenticated user (needed by the sales screen)
  fastify.get("/products", {
    schema: { tags: ["products"], summary: "List all products" },
  }, async (request, reply) => {
    const { categoryId, active, search } = request.query as {
      categoryId?: string;
      active?: string;
      search?: string;
    };

    const conditions = [];
    if (categoryId) conditions.push(eq(products.categoryId, parseInt(categoryId, 10)));
    if (active !== undefined) conditions.push(eq(products.active, active === "true"));
    if (search) conditions.push(like(products.name, `%${search}%`));

    const rows = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(products.sortOrder), asc(products.name));

    return reply.send(rows.map(mapProductRow));
  });

  fastify.get("/products/:id", {
    schema: { tags: ["products"], summary: "Get a product by id" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const [row] = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, numId));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send(mapProductRow(row));
  });

  fastify.post("/products", {
    schema: { tags: ["products"], summary: "Create a product" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      price: number;
      categoryId?: number | null;
      productionCenterId?: number | null;
      active?: boolean;
      color?: string;
      description?: string;
      imageData?: string;
      sortOrder?: number;
      vatRate?: number;
      receiptPrintMode?: "inherit" | "included" | "separate";
      availableDates?: string[] | null;
    };
    const now = Date.now();
    const [row] = await fastify.ctx.db.insert(products).values({
      name:               body.name,
      price:              body.price,
      categoryId:         body.categoryId ?? null,
      productionCenterId: body.productionCenterId ?? null,
      active:             body.active ?? true,
      color:              body.color ?? null,
      description:        body.description ?? null,
      imageData:          body.imageData ?? null,
      sortOrder:          body.sortOrder ?? 0,
      vatRate:            body.vatRate ?? 10,
      receiptPrintMode:   body.receiptPrintMode ?? "inherit",
      availableDates:     serializeAvailableDates(body.availableDates),
      createdAt:          now,
      updatedAt:          now,
    }).returning();
    fastify.ctx.eventBus.emit("PRODUCT_CREATED", { traceId: crypto.randomUUID(), id: row!.id, timestamp: new Date() });
    return reply.status(201).send(mapProductRow(row!));
  });

  fastify.patch("/products/:id", {
    schema: { tags: ["products"], summary: "Update a product" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{
      name: string;
      price: number;
      categoryId: number | null;
      productionCenterId: number | null;
      active: boolean;
      color: string | null;
      description: string | null;
      imageData: string | null;
      sortOrder: number;
      vatRate: number;
      receiptPrintMode: "inherit" | "included" | "separate";
      availableDates: string[] | null;
    }>;

    const [existing] = await fastify.ctx.db.select().from(products).where(eq(products.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      price?: number;
      categoryId?: number | null;
      productionCenterId?: number | null;
      active?: boolean;
      color?: string | null;
      description?: string | null;
      imageData?: string | null;
      sortOrder?: number;
      vatRate?: number;
      receiptPrintMode?: "inherit" | "included" | "separate";
      availableDates?: string | null;
      updatedAt?: number;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.price !== undefined) update.price = body.price;
    if ("categoryId" in body) update.categoryId = body.categoryId ?? null;
    if ("productionCenterId" in body) update.productionCenterId = body.productionCenterId ?? null;
    if (body.active !== undefined) update.active = body.active;
    if ("color" in body) update.color = body.color ?? null;
    if ("description" in body) update.description = body.description ?? null;
    if ("imageData" in body) update.imageData = body.imageData ?? null;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
    if (body.vatRate !== undefined) update.vatRate = body.vatRate;
    if (body.receiptPrintMode !== undefined) update.receiptPrintMode = body.receiptPrintMode;
    if ("availableDates" in body) update.availableDates = serializeAvailableDates(body.availableDates);

    if (Object.keys(update).length > 0) {
      update.updatedAt = Date.now();
      await fastify.ctx.db.update(products).set(update).where(eq(products.id, numId));
    }

    const [row] = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, numId));
    fastify.ctx.eventBus.emit("PRODUCT_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.send(mapProductRow(row!));
  });

  fastify.delete("/products/:id", {
    schema: { tags: ["products"], summary: "Delete a product" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const [existing] = await fastify.ctx.db.select({ imageData: products.imageData }).from(products).where(eq(products.id, numId));
    if (existing?.imageData) {
      const absPath = resolve(join(fastify.ctx.config.dataDir, existing.imageData));
      if (existsSync(absPath)) { try { unlinkSync(absPath); } catch { /* ok */ } }
    }
    await fastify.ctx.db.delete(products).where(eq(products.id, numId));
    fastify.ctx.eventBus.emit("PRODUCT_DELETED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });

  // POST /products/:id/image — upload product image
  fastify.post("/products/:id/image", {
    schema: { tags: ["products"], summary: "Upload product image" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);

    const [existing] = await fastify.ctx.db.select({ id: products.id }).from(products).where(eq(products.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const MIME_TO_EXT: Record<string, string> = {
      "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
      "image/webp": ".webp", "image/gif": ".gif",
    };
    const ext = MIME_TO_EXT[data.mimetype];
    if (!ext) {
      return reply.status(400).send({ error: "Only PNG/JPG/WEBP/GIF allowed" });
    }

    const IMAGES_DIR = resolve(productImagesDir(fastify.ctx.config.dataDir));
    ensureDir(IMAGES_DIR);
    const safeFilename = `${numId}${ext}`;
    const relPath = `images/products/${safeFilename}`;
    const absPath = join(IMAGES_DIR, safeFilename);

    // Remove old image files for this product (different extension)
    for (const oldExt of IMAGE_EXTS) {
      const old = join(IMAGES_DIR, `${numId}${oldExt}`);
      if (old !== absPath && existsSync(old)) { try { unlinkSync(old); } catch { /* ok */ } }
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    await writeFile(absPath, Buffer.concat(chunks));

    await fastify.ctx.db.update(products)
      .set({ imageData: relPath, updatedAt: Date.now() })
      .where(eq(products.id, numId));
    fastify.ctx.eventBus.emit("PRODUCT_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });

    return reply.send({ imagePath: `/api/static/${relPath}` });
  });

  // DELETE /products/:id/image — remove product image
  fastify.delete("/products/:id/image", {
    schema: { tags: ["products"], summary: "Remove product image" },
    preHandler: adminOnly,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);

    const [existing] = await fastify.ctx.db.select({ imageData: products.imageData }).from(products).where(eq(products.id, numId));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (existing.imageData) {
      const absPath = resolve(join(fastify.ctx.config.dataDir, existing.imageData));
      if (existsSync(absPath)) { try { unlinkSync(absPath); } catch { /* ok */ } }
    }

    await fastify.ctx.db.update(products)
      .set({ imageData: null, updatedAt: Date.now() })
      .where(eq(products.id, numId));
    fastify.ctx.eventBus.emit("PRODUCT_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });

    return reply.status(204).send();
  });

};

export default productsRoutes;
