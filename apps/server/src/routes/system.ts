import type { FastifyPluginAsync } from "fastify";
import { exec } from "node:child_process";

function shutdownCommand(): string {
  switch (process.platform) {
    case "darwin":
    case "linux":
      return "shutdown -h now";
    case "win32":
      return "shutdown /s /t 0";
    default:
      throw new Error(`Spegnimento non supportato su piattaforma "${process.platform}"`);
  }
}

const systemRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/system/shutdown",
    {
      schema: {
        tags: ["system"],
        summary: "Spegne il dispositivo",
        description: "Esegue lo spegnimento del sistema operativo che ospita il POS. Raggiungibile senza autenticazione: pensato per il tasto di spegnimento sulla schermata di login di un chiosco fisico.",
        response: {
          202: {
            type: "object",
            properties: { ok: { type: "boolean" } },
          },
        },
      },
    },
    async (_req, reply) => {
      let command: string;
      try {
        command = shutdownCommand();
      } catch (err) {
        fastify.ctx.logger.error({ err }, "Shutdown non supportato su questa piattaforma");
        return reply.status(501).send({ error: err instanceof Error ? err.message : "Non supportato" });
      }

      fastify.ctx.logger.warn({ platform: process.platform, command }, "Richiesto spegnimento del dispositivo");

      // Rispondiamo prima di eseguire: la macchina si spegnerà e non potrà
      // comunque inviare la risposta dopo che il processo viene terminato.
      reply.status(202).send({ ok: true });

      exec(command, (err) => {
        if (err) {
          fastify.ctx.logger.error({ err }, "Comando di spegnimento fallito");
        }
      });
    }
  );
};

export default systemRoute;
