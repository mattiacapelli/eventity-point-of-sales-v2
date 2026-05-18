import type { PosModule } from "@pos/shared-types";

export const eventsModule: PosModule = {
  name: "events",
  version: "0.1.0",
  async init(_ctx) {},
  async register(_ctx) {},
  async start() { console.log("[events] started"); },
  async stop()  { console.log("[events] stopped"); },
};
