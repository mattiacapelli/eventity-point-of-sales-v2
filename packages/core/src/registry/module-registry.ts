import type { PosModule } from "@pos/shared-types";

export type ModuleState = "registered" | "initializing" | "running" | "stopped" | "error";

export interface ModuleEntry {
  readonly module: PosModule;
  state: ModuleState;
  error?: Error;
  registeredAt: Date;
  startedAt?: Date;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleEntry>();

  register(module: PosModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered.`);
    }
    this.modules.set(module.name, {
      module,
      state: "registered",
      registeredAt: new Date(),
    });
  }

  get(name: string): ModuleEntry | undefined {
    return this.modules.get(name);
  }

  getAll(): ReadonlyMap<string, ModuleEntry> {
    return this.modules;
  }

  setState(name: string, state: ModuleState, error?: Error): void {
    const entry = this.modules.get(name);
    if (entry === undefined) {
      throw new Error(`Module "${name}" is not registered.`);
    }
    entry.state = state;
    if (error !== undefined) entry.error = error;
    if (state === "running") entry.startedAt = new Date();
  }

  isRegistered(name: string): boolean {
    return this.modules.has(name);
  }

  getRunningModules(): ReadonlyArray<ModuleEntry> {
    return Array.from(this.modules.values()).filter((e) => e.state === "running");
  }
}
