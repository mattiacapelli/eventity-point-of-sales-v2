import type { FastifyPluginAsync } from "fastify";

const diagnosticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/modules",
    {
      schema: {
        tags: ["system"],
        summary: "List all registered modules and their state",
        response: {
          200: {
            type: "object",
            properties: {
              modules: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    version: { type: "string" },
                    state: { type: "string" },
                    registeredAt: { type: "string" },
                    startedAt: { type: "string", nullable: true },
                    error: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      const registry = fastify.posRuntime.registry;
      const modules = Array.from(registry.getAll().values()).map((entry) => ({
        name: entry.module.name,
        version: entry.module.version,
        state: entry.state,
        registeredAt: entry.registeredAt.toISOString(),
        startedAt: entry.startedAt?.toISOString() ?? null,
        error: entry.error?.message ?? null,
      }));
      return reply.send({ modules });
    }
  );

  fastify.get(
    "/events/debug",
    {
      schema: {
        tags: ["system"],
        summary: "Recent events emitted through the event bus (ring buffer, last 50)",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              events: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    traceId: { type: "string" },
                    event: { type: "string" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit } = (request.query as { limit?: number });
      const events = fastify.ctx.eventBus
        .getRecentEvents(limit ?? 50)
        .map((e) => ({
          traceId: e.traceId,
          event: e.event,
          timestamp: e.timestamp.toISOString(),
        }));
      return reply.send({ events });
    }
  );
};

export default diagnosticsRoutes;
