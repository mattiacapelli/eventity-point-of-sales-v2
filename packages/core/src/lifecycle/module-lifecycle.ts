import type { PosModule } from "@pos/shared-types";
import type { IEventBus } from "@pos/event-bus";
import type { Logger } from "../logger/logger.js";
import type { CoreContext } from "../context/core-context.js";
import { ModuleRegistry } from "../registry/module-registry.js";

export class ModuleLifecycle {
  constructor(
    private readonly registry: ModuleRegistry,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger
  ) {}

  async registerModule(module: PosModule, ctx: CoreContext): Promise<void> {
    this.registry.register(module);

    try {
      this.registry.setState(module.name, "initializing");
      await module.init(ctx);
      await module.register(ctx);
      this.registry.setState(module.name, "registered");

      this.eventBus.emit("MODULE_REGISTERED", {
        moduleName: module.name,
        version: module.version,
        timestamp: new Date(),
      });

      this.logger.info({ module: module.name }, "Module registered");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.registry.setState(module.name, "error", error);
      this.eventBus.emit("MODULE_ERROR", {
        moduleName: module.name,
        error: error.message,
        timestamp: new Date(),
      });
      this.logger.error({ module: module.name, err: error.message }, "Module registration failed");
      throw error;
    }
  }

  async startModule(name: string): Promise<void> {
    const entry = this.registry.get(name);
    if (entry === undefined) throw new Error(`Module "${name}" is not registered.`);

    try {
      await entry.module.start();
      this.registry.setState(name, "running");
      this.eventBus.emit("MODULE_STARTED", { moduleName: name, timestamp: new Date() });
      this.logger.info({ module: name }, "Module started");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.registry.setState(name, "error", error);
      this.eventBus.emit("MODULE_ERROR", {
        moduleName: name,
        error: error.message,
        timestamp: new Date(),
      });
      this.logger.error({ module: name, err: error.message }, "Module start failed");
      throw error;
    }
  }

  async stopModule(name: string): Promise<void> {
    const entry = this.registry.get(name);
    if (entry === undefined || entry.state !== "running") return;
    await entry.module.stop?.();
    this.registry.setState(name, "stopped");
    this.logger.info({ module: name }, "Module stopped");
  }

  async startAll(): Promise<void> {
    for (const entry of this.registry.getAll().values()) {
      if (entry.state === "registered") {
        await this.startModule(entry.module.name);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const entry of this.registry.getRunningModules()) {
      await this.stopModule(entry.module.name);
    }
  }
}
