import type { CoreContext } from "../context/core-context.js";
import { ModuleRegistry } from "../registry/module-registry.js";
import { ModuleLifecycle } from "../lifecycle/module-lifecycle.js";
import type { PosModule } from "@pos/shared-types";

export class PosRuntime {
  readonly registry: ModuleRegistry;
  readonly lifecycle: ModuleLifecycle;

  constructor(private readonly ctx: CoreContext) {
    this.registry = new ModuleRegistry();
    this.lifecycle = new ModuleLifecycle(this.registry, ctx.eventBus, ctx.logger);
  }

  async use(module: PosModule): Promise<this> {
    await this.lifecycle.registerModule(module, this.ctx);
    return this;
  }

  async start(): Promise<void> {
    await this.lifecycle.startAll();
  }

  async stop(): Promise<void> {
    await this.lifecycle.stopAll();
  }
}
