import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "@pos/db";
import { modules } from "@pos/db";
import { requireRole, AuthError } from "@pos/core";
import { MODULE_DEPENDENCIES } from "@pos/shared-types";
import { randomUUID } from "node:crypto";

const modulesRoutes: FastifyPluginAsync = async (fastify) => {
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

  // GET /admin/modules
  fastify.get("/admin/modules", {
    schema: { tags: ["modules"], summary: "List all modules with status" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(modules);
    const result = rows.map((row) => {
      const deps = MODULE_DEPENDENCIES[row.name] ?? [];
      const depErrors: string[] = [];
      for (const dep of deps) {
        const depRow = rows.find((r) => r.name === dep);
        if (!depRow?.enabled) {
          depErrors.push(`Required module "${dep}" is disabled`);
        }
      }
      return {
        name: row.name,
        enabled: row.enabled,
        version: row.version,
        config: row.config ? JSON.parse(row.config) as unknown : null,
        dependencies: deps,
        dependencyErrors: depErrors,
      };
    });
    return reply.send(result);
  });

  // PATCH /admin/modules/:name/toggle
  fastify.patch("/admin/modules/:name/toggle", {
    schema: {
      tags: ["modules"],
      summary: "Toggle module enabled state",
      params: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const rows = await fastify.ctx.db.select().from(modules);
    const target = rows.find((r) => r.name === name);
    if (!target) return reply.status(404).send({ error: `Module "${name}" not found` });

    const next = !target.enabled;

    if (next) {
      // Enabling: check all dependencies are enabled
      const deps = MODULE_DEPENDENCIES[name] ?? [];
      for (const dep of deps) {
        const depRow = rows.find((r) => r.name === dep);
        if (!depRow?.enabled) {
          return reply.status(422).send({ error: `Cannot enable "${name}": required module "${dep}" is disabled` });
        }
      }
    } else {
      // Disabling: check no enabled module depends on this one
      for (const [modName, deps] of Object.entries(MODULE_DEPENDENCIES)) {
        if (!deps.includes(name)) continue;
        const depRow = rows.find((r) => r.name === modName);
        if (depRow?.enabled) {
          return reply.status(422).send({ error: `Cannot disable "${name}": module "${modName}" depends on it` });
        }
      }
    }

    const now = Math.floor(Date.now() / 1000);
    await fastify.ctx.db.update(modules).set({ enabled: next, updatedAt: now }).where(eq(modules.name, name));

    fastify.ctx.eventBus.emit("MODULE_STATE_CHANGED", {
      traceId: randomUUID(),
      moduleName: name,
      enabled: next,
      timestamp: new Date(),
    });

    return reply.send({ name, enabled: next });
  });

  // PATCH /admin/modules/:name/config
  fastify.patch("/admin/modules/:name/config", {
    schema: {
      tags: ["modules"],
      summary: "Update module config",
      params: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["config"],
        properties: { config: { type: "object" } },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const { config } = request.body as { config: Record<string, unknown> };

    const [existing] = await fastify.ctx.db.select().from(modules).where(eq(modules.name, name)).limit(1);
    if (!existing) return reply.status(404).send({ error: `Module "${name}" not found` });

    const now = Math.floor(Date.now() / 1000);
    await fastify.ctx.db.update(modules).set({ config: JSON.stringify(config), updatedAt: now }).where(eq(modules.name, name));

    return reply.send({ name, config });
  });

  // POST /admin/modules/:name/reload
  fastify.post("/admin/modules/:name/reload", {
    schema: {
      tags: ["modules"],
      summary: "Reload a module (emits MODULE_STATE_CHANGED)",
      params: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const [existing] = await fastify.ctx.db.select().from(modules).where(eq(modules.name, name)).limit(1);
    if (!existing) return reply.status(404).send({ error: `Module "${name}" not found` });

    fastify.ctx.eventBus.emit("MODULE_STATE_CHANGED", {
      traceId: randomUUID(),
      moduleName: name,
      enabled: existing.enabled ?? false,
      timestamp: new Date(),
    });

    return reply.send({ name, state: existing.enabled ? "running" : "disabled" });
  });
};

export default modulesRoutes;
