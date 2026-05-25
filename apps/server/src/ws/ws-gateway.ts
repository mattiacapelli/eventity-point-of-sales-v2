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
    (socket: WebSocket, request) => {
      const clientId = randomUUID();
      const terminalId = new URL(request.url, "http://x").searchParams.get("terminalId") ?? null;

      broadcaster.addClient({
        id: clientId,
        terminalId,
        send: (data: string) => socket.send(data),
        isAlive: () => socket.readyState === socket.OPEN,
      });

      fastify.ctx.logger.debug({ clientId }, "WS client connected");

      socket.on("message", (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type?: string };
          if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
            return;
          }
          fastify.ctx.logger.debug({ clientId, msg }, "WS message received");
        } catch {
          fastify.ctx.logger.warn({ clientId }, "WS: could not parse message");
        }
      });

      socket.on("close", () => {
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
