import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq, appSettings } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";

const appSettingsRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /admin/settings
  fastify.get("/admin/settings", {
    schema: {
      tags: ["admin"],
      summary: "Get app settings",
      response: {
        200: {
          type: "object",
          properties: { expressMode: { type: "boolean" } },
        },
      },
    },
  }, async (_request, reply) => {
    const db = fastify.ctx.db;
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "express_mode"));
    const expressMode = rows[0]?.value === "true";
    return reply.send({ expressMode });
  });

  // PATCH /admin/settings
  fastify.patch("/admin/settings", {
    schema: {
      tags: ["admin"],
      summary: "Update app settings",
      body: {
        type: "object",
        required: ["expressMode"],
        properties: { expressMode: { type: "boolean" } },
      },
      response: {
        200: {
          type: "object",
          properties: { expressMode: { type: "boolean" } },
        },
      },
    },
  }, async (request, reply) => {
    const { expressMode } = request.body as { expressMode: boolean };
    const db = fastify.ctx.db;
    await db
      .update(appSettings)
      .set({ value: String(expressMode) })
      .where(eq(appSettings.key, "express_mode"));
    return reply.send({ expressMode });
  });
};

export default appSettingsRoutes;
