import type { PosModule } from "@pos/shared-types";

export const inventoryModule: PosModule = {
  name: "inventory",
  version: "0.1.0",
  async init(_ctx) {},
  async register(_ctx) {},
  async start() { console.log("[inventory] started"); },
  async stop()  { console.log("[inventory] stopped"); },
};
