import type { PosModule } from "@pos/shared-types";

export interface FrontendModuleEntry {
  readonly manifest: PosModule;
  loaded: boolean;
}

export class FrontendModuleLoader {
  private readonly registry = new Map<string, FrontendModuleEntry>();

  register(manifest: PosModule): void {
    if (this.registry.has(manifest.name)) {
      console.warn(`[ModuleLoader] Module "${manifest.name}" already registered`);
      return;
    }
    this.registry.set(manifest.name, { manifest, loaded: false });
  }

  markLoaded(name: string): void {
    const entry = this.registry.get(name);
    if (entry !== undefined) entry.loaded = true;
  }

  getAll(): ReadonlyArray<FrontendModuleEntry> {
    return Array.from(this.registry.values());
  }

  isLoaded(name: string): boolean {
    return this.registry.get(name)?.loaded ?? false;
  }
}
