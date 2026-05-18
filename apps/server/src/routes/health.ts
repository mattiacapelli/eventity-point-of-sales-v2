import type { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Health check",
        description: "Returns server liveness, DB status, uptime and connected WS clients.",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              timestamp: { type: "string", format: "date-time" },
              uptime: { type: "number" },
              db: { type: "string", enum: ["ok", "error"] },
              wsClients: { type: "number" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      let dbStatus: "ok" | "error" = "ok";
      try {
        fastify.ctx.db.run("SELECT 1" as never);
      } catch {
        dbStatus = "error";
      }

      return reply.send({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        db: dbStatus,
        wsClients: fastify.wsBroadcaster?.clientCount() ?? 0,
      });
    }
  );
};

export default healthRoute;
