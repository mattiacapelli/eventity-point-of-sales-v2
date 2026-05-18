import { getGlobalEventBus } from "@pos/event-bus";
import { PrinterService } from "./printer-service.js";

const bus = getGlobalEventBus();
const service = new PrinterService(bus);

service.start();
console.log("[PrinterAgent] Running");

const shutdown = (): void => {
  service.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
