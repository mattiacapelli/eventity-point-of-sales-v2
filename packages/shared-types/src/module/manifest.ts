import type { PlatformEventName } from "../events/bus-events.js";

export type ModulePermission =
  | "orders:read"
  | "orders:write"
  | "payments:read"
  | "payments:write"
  | "users:read"
  | "users:write"
  | "kitchen:read"
  | "kitchen:write"
  | "tables:read"
  | "tables:write"
  | "inventory:read"
  | "inventory:write"
  | "events:read"
  | "events:write"
  | "print:send";

export interface RouteDefinition {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly description?: string;
}

export interface ModuleManifest {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly routes?: ReadonlyArray<RouteDefinition>;
  readonly events?: ReadonlyArray<PlatformEventName>;
  readonly permissions?: ReadonlyArray<ModulePermission>;
}

/**
 * CoreContext is referenced by name here to avoid a circular package dependency.
 * The actual type is provided by @pos/core at runtime — modules that need it
 * import CoreContext directly from @pos/core.
 */
export interface PosModule extends ModuleManifest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init(ctx: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(ctx: any): Promise<void>;
  start(): Promise<void>;
  stop?(): Promise<void>;
}
