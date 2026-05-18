import type { FastifyPluginAsync } from "fastify";
import { AuthError } from "@pos/core";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login with PIN",
        body: {
          type: "object",
          required: ["pin"],
          properties: {
            pin: { type: "string", minLength: 4, maxLength: 8 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              role: { type: "string" },
              userId: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const { pin } = request.body as { pin: string };

      try {
        const result = await fastify.authService.loginByPin(pin);
        fastify.ctx.eventBus.emit("USER_LOGGED_IN", {
          traceId: crypto.randomUUID(),
          userId: result.session.userId,
          role: result.session.role,
          timestamp: new Date(),
        });
        return reply.send({
          token: result.token,
          role: result.session.role,
          userId: result.session.userId,
        });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  fastify.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Logout — invalidate session token",
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
        },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (token !== null) {
        await fastify.authService.logout(token);
        fastify.ctx.eventBus.emit("USER_LOGGED_OUT", {
          traceId: crypto.randomUUID(),
          userId: request.session?.userId ?? "unknown",
          timestamp: new Date(),
        });
      }
      return reply.send({ ok: true });
    }
  );

  fastify.get(
    "/auth/me",
    {
      schema: {
        tags: ["auth"],
        summary: "Get current session user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              userId: { type: "string" },
              role: { type: "string" },
              sessionId: { type: "string" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { session } = request;
      if (session === null) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return reply.send({
        userId: session.userId,
        role: session.role,
        username: session.username,
        sessionId: session.sessionId,
      });
    }
  );

  // Bootstrap route — create user (first-run or admin use)
  fastify.post(
    "/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Create a user (admin or first-run setup)",
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
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        username: string;
        role: "admin" | "cashier" | "kitchen" | "waiter" | "viewer";
        pin: string;
      };
      try {
        const userId = await fastify.authService.createUser(body);
        return reply.status(201).send({ userId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        // unique constraint violation
        if (msg.includes("UNIQUE")) {
          return reply.status(409).send({ error: "Username already exists" });
        }
        throw err;
      }
    }
  );
};

export default authRoutes;
