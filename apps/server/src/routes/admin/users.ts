import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { requireRole, AuthError } from "@pos/core";
import type { UserRole } from "@pos/shared-types";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  // GET /admin/users
  fastify.get("/admin/users", {
    schema: { tags: ["users"], summary: "List all users" },
  }, async (_request, reply) => {
    const rows = await fastify.authService.listUsers();
    return reply.send(rows);
  });

  // POST /admin/users
  fastify.post("/admin/users", {
    schema: {
      tags: ["users"],
      summary: "Create a user",
      body: {
        type: "object",
        required: ["name", "username", "role", "pin"],
        properties: {
          name:     { type: "string", minLength: 1 },
          username: { type: "string", minLength: 3, maxLength: 32 },
          role:     { type: "string", enum: ["admin", "cashier", "kitchen", "waiter", "viewer"] },
          pin:      { type: "string", minLength: 4, maxLength: 8 },
        },
      },
      response: {
        201: { type: "object", properties: { userId: { type: "string" } } },
        409: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { name: string; username: string; role: UserRole; pin: string };
    try {
      const userId = await fastify.authService.createUser(body);
      return reply.status(201).send({ userId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Creation failed";
      if (msg.includes("UNIQUE")) {
        return reply.status(409).send({ error: "Username already exists" });
      }
      throw err;
    }
  });

  // PATCH /admin/users/:id
  fastify.patch("/admin/users/:id", {
    schema: {
      tags: ["users"],
      summary: "Update a user",
      response: {
        409: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{ name: string; username: string; role: UserRole; active: boolean }>;
    try {
      await fastify.authService.updateUser(numId, body);
      return reply.send({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      if (msg.includes("UNIQUE")) {
        return reply.status(409).send({ error: "Username already exists" });
      }
      throw err;
    }
  });

  // POST /admin/users/:id/reset-pin
  fastify.post("/admin/users/:id/reset-pin", {
    schema: {
      tags: ["users"],
      summary: "Reset a user's PIN (admin action)",
      body: {
        type: "object",
        required: ["newPin"],
        properties: {
          newPin: { type: "string", minLength: 4, maxLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const { newPin } = request.body as { newPin: string };
    await fastify.authService.resetPin(numId, newPin);
    return reply.send({ ok: true });
  });
};

export default usersRoutes;
