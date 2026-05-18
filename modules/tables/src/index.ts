import type { PosModule } from "@pos/shared-types";

export const tablesModule: PosModule = {
  name: "tables",
  version: "0.1.0",
  async init(_ctx) {},
  async register(_ctx) {},
  async start() { console.log("[tables] started"); },
  async stop()  { console.log("[tables] stopped"); },
};
