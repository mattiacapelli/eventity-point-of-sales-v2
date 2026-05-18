import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, users, paymentMethods, categories } from "@pos/db";
import { AuthService } from "@pos/core";
import { randomUUID } from "node:crypto";

const bootstrapRoutes: FastifyPluginAsync = async (fastify) => {
  const getStatus = async () => {
    const db = fastify.ctx.db;
    const [adminUsers, pmRows, catRows] = await Promise.all([
      db.select().from(users).where(eq(users.role, "admin")),
      db.select().from(paymentMethods),
      db.select().from(categories),
    ]);
    const hasAdmin = adminUsers.length > 0;
    const hasPaymentMethods = pmRows.length > 0;
    const hasCategories = catRows.length > 0;
    return {
      initialized: hasAdmin && hasPaymentMethods,
      checks: { hasAdmin, hasPaymentMethods, hasCategories },
    };
  };

  fastify.get("/bootstrap/status", {
    schema: { tags: ["bootstrap"], summary: "Check if the store is initialized" },
  }, async (_request, reply) => {
    return reply.send(await getStatus());
  });

  fastify.post("/bootstrap/init", {
    schema: { tags: ["bootstrap"], summary: "Initialize the store for first use" },
  }, async (request, reply) => {
    const status = await getStatus();
    if (status.initialized) {
      return reply.status(409).send({ error: "Store is already initialized" });
    }

    const body = request.body as {
      storeName?: string;
      adminPin: string;
      adminName?: string;
    };

    if (!body.adminPin || body.adminPin.length < 4) {
      return reply.status(400).send({ error: "PIN must be at least 4 digits" });
    }

    const authService = new AuthService(fastify.ctx.db, 86400);
    const storeName = body.storeName ?? "Eventity POS";
    const adminName = body.adminName ?? "Admin";

    // Create admin user — username derived from store name, normalized
    const username = storeName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) + "_admin";

    await authService.createUser({
      name: adminName,
      username,
      role: "admin",
      pin: body.adminPin,
    });

    // Seed default payment methods
    const now = Date.now();
    await fastify.ctx.db.insert(paymentMethods).values([
      { id: randomUUID(), name: "Contanti", type: "cash",  active: true, sortOrder: 0 },
      { id: randomUUID(), name: "Carta",    type: "card",  active: true, sortOrder: 1 },
    ]);

    fastify.ctx.logger.info({ storeName, username }, "Store initialized via bootstrap");

    return reply.status(201).send({
      ok: true,
      username,
      message: "Store initialized. Use the username and PIN above to log in.",
    });
  });
};

export default bootstrapRoutes;
