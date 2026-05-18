import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, asc } from "@pos/db";
import { products, categories } from "@pos/db";
import { randomUUID } from "node:crypto";

const PRODUCT_SELECT = {
  id:           products.id,
  name:         products.name,
  price:        products.price,
  categoryId:   products.categoryId,
  categoryName: categories.name,
  active:       products.active,
  color:        products.color,
  description:  products.description,
  imageData:    products.imageData,
  sortOrder:    products.sortOrder,
  createdAt:    products.createdAt,
  updatedAt:    products.updatedAt,
} as const;

const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/products", {
    schema: { tags: ["products"], summary: "List all products" },
  }, async (request, reply) => {
    const { categoryId, active, search } = request.query as {
      categoryId?: string;
      active?: string;
      search?: string;
    };

    let query = fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(asc(products.sortOrder), asc(products.name));

    // Apply filters via where chaining isn't easily composable in drizzle without and()
    // So we fetch all and filter in JS — acceptable for the small datasets at play
    let rows = await query;
    if (categoryId) rows = rows.filter((r) => r.categoryId === categoryId);
    if (active !== undefined) rows = rows.filter((r) => r.active === (active === "true"));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return reply.send(rows);
  });

  fastify.get("/products/:id", {
    schema: { tags: ["products"], summary: "Get a product by id" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [row] = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    if (!row) return reply.status(404).send({ error: "Not found" });
    return reply.send(row);
  });

  fastify.post("/products", {
    schema: { tags: ["products"], summary: "Create a product" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      price: number;
      categoryId?: string;
      active?: boolean;
      color?: string;
      description?: string;
      imageData?: string;
      sortOrder?: number;
    };
    const id = randomUUID();
    const now = Date.now();
    await fastify.ctx.db.insert(products).values({
      id,
      name:        body.name,
      price:       body.price,
      categoryId:  body.categoryId ?? null,
      active:      body.active ?? true,
      color:       body.color ?? null,
      description: body.description ?? null,
      imageData:   body.imageData ?? null,
      sortOrder:   body.sortOrder ?? 0,
      createdAt:   now,
      updatedAt:   now,
    });
    const [row] = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/products/:id", {
    schema: { tags: ["products"], summary: "Update a product" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      price: number;
      categoryId: string | null;
      active: boolean;
      color: string | null;
      description: string | null;
      imageData: string | null;
      sortOrder: number;
    }>;

    const [existing] = await fastify.ctx.db.select().from(products).where(eq(products.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      price?: number;
      categoryId?: string | null;
      active?: boolean;
      color?: string | null;
      description?: string | null;
      imageData?: string | null;
      sortOrder?: number;
      updatedAt?: number;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.price !== undefined) update.price = body.price;
    if ("categoryId" in body) update.categoryId = body.categoryId ?? null;
    if (body.active !== undefined) update.active = body.active;
    if ("color" in body) update.color = body.color ?? null;
    if ("description" in body) update.description = body.description ?? null;
    if ("imageData" in body) update.imageData = body.imageData ?? null;
    if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;

    if (Object.keys(update).length > 0) {
      update.updatedAt = Date.now();
      await fastify.ctx.db.update(products).set(update).where(eq(products.id, id));
    }

    const [row] = await fastify.ctx.db
      .select(PRODUCT_SELECT)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));
    return reply.send(row);
  });

  fastify.delete("/products/:id", {
    schema: { tags: ["products"], summary: "Delete a product" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(products).where(eq(products.id, id));
    return reply.status(204).send();
  });
};

export default productsRoutes;
