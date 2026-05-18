import { loadConfig } from "@pos/core";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = await buildServer(config);

  try {
    await server.listen({ host: config.host, port: config.port });
    server.ctx.logger.info(
      { host: config.host, port: config.port },
      "Server listening"
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }

  const shutdown = async (): Promise<void> => {
    server.ctx.logger.info("Shutting down...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
