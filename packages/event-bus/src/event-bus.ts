import { randomUUID } from "node:crypto";
import type { PlatformEventMap, PlatformEventName } from "@pos/shared-types";
import type { EventHandler, EventSubscription, IEventBus, LoggedEvent } from "./types.js";

type HandlerSet = Set<EventHandler<PlatformEventName>>;

const RING_BUFFER_SIZE = 200;

export class EventBus implements IEventBus {
  private readonly listeners = new Map<PlatformEventName, HandlerSet>();
  private readonly recentEvents: LoggedEvent[] = [];
  private readonly logger: ((event: string, traceId: string) => void) | null;

  constructor(opts: { log?: (event: string, traceId: string) => void } = {}) {
    this.logger = opts.log ?? null;
  }

  emit<K extends PlatformEventName>(event: K, payload: PlatformEventMap[K]): void {
    const traceId =
      "traceId" in (payload as object) && typeof (payload as Record<string, unknown>)["traceId"] === "string"
        ? ((payload as Record<string, unknown>)["traceId"] as string)
        : randomUUID();

    this.recordEvent(event, traceId);
    this.logger?.(event, traceId);

    const handlers = this.listeners.get(event);
    if (handlers === undefined) return;

    for (const handler of handlers) {
      try {
        const result = (handler as EventHandler<K>)(payload);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            console.error(`[EventBus] async error "${event}" (${traceId}):`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] sync error "${event}" (${traceId}):`, err);
      }
    }
  }

  on<K extends PlatformEventName>(event: K, handler: EventHandler<K>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<PlatformEventName>);
    return { eventName: event, unsubscribe: () => this.off(event, handler) };
  }

  off<K extends PlatformEventName>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<PlatformEventName>);
  }

  once<K extends PlatformEventName>(event: K, handler: EventHandler<K>): EventSubscription {
    const wrapper: EventHandler<K> = (payload) => {
      this.off(event, wrapper);
      return handler(payload);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: PlatformEventName): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: PlatformEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  getRecentEvents(limit = 50): ReadonlyArray<LoggedEvent> {
    return this.recentEvents.slice(-limit);
  }

  private recordEvent(event: PlatformEventName, traceId: string): void {
    if (this.recentEvents.length >= RING_BUFFER_SIZE) {
      this.recentEvents.shift();
    }
    this.recentEvents.push({ traceId, event, timestamp: new Date() });
  }
}

let _globalBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (_globalBus === null) {
    _globalBus = new EventBus();
  }
  return _globalBus;
}
