import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { WsBroadcaster } from "@pos/core";
import { randomUUID } from "node:crypto";

declare module "fastify" {
  interface FastifyInstance {
    wsBroadcaster: WsBroadcaster;
  }
}

const wsGateway: FastifyPluginAsync = async (fastify) => {
  const broadcaster = new WsBroadcaster(fastify.ctx.eventBus);
  broadcaster.start();
  fastify.decorate("wsBroadcaster", broadcaster);

  fastify.get(
    "/ws",
    { websocket: true },
    async (socket: WebSocket, request) => {
      const params = new URL(request.url, "http://x").searchParams;
      const token = params.get("token");
      const terminalId = params.get("terminalId") ?? null;

      if (!token) {
        socket.close(1008, "Missing token");
        return;
      }

      try {
        await fastify.authService.validateToken(token);
      } catch {
        socket.close(1008, "Invalid or expired token");
        return;
      }

      const clientId = randomUUID();

      broadcaster.addClient({
        id: clientId,
        terminalId,
        send: (data: string) => socket.send(data),
        isAlive: () => socket.readyState === socket.OPEN,
      });

      fastify.ctx.logger.debug({ clientId }, "WS client connected");

      const pingInterval = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30_000);

      socket.on("message", (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type?: string };
          if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (msg.type === "pong") return;
          fastify.ctx.logger.debug({ clientId, msg }, "WS message received");
        } catch {
          fastify.ctx.logger.warn({ clientId }, "WS: could not parse message");
        }
      });

      socket.on("close", () => {
        clearInterval(pingInterval);
        broadcaster.removeClient(clientId);
        fastify.ctx.logger.debug({ clientId }, "WS client disconnected");
      });
    }
  );

  fastify.addHook("onClose", async () => {
    broadcaster.stop();
  });
};

export default fp(wsGateway, { name: "ws-gateway", dependencies: ["core-context"] });
