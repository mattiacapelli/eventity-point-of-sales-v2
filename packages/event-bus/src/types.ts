import type { PlatformEventMap, PlatformEventName } from "@pos/shared-types";

export type EventHandler<K extends PlatformEventName> = (
  payload: PlatformEventMap[K]
) => void | Promise<void>;

export interface EventSubscription {
  readonly eventName: PlatformEventName;
  readonly unsubscribe: () => void;
}

export interface LoggedEvent {
  readonly traceId: string;
  readonly event: PlatformEventName;
  readonly timestamp: Date;
}

export interface IEventBus {
  emit<K extends PlatformEventName>(event: K, payload: PlatformEventMap[K]): void;
  on<K extends PlatformEventName>(event: K, handler: EventHandler<K>): EventSubscription;
  off<K extends PlatformEventName>(event: K, handler: EventHandler<K>): void;
  once<K extends PlatformEventName>(event: K, handler: EventHandler<K>): EventSubscription;
  removeAllListeners(event?: PlatformEventName): void;
  listenerCount(event: PlatformEventName): number;
  getRecentEvents(limit?: number): ReadonlyArray<LoggedEvent>;
}
