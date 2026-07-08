import type { EventBus, EventSubscription } from "@pos/event-bus";
import type { PlatformEventName, PlatformEventMap } from "@pos/shared-types";

export interface WsClient {
  readonly id: string;
  readonly terminalId: string | null;
  send(data: string): void;
  isAlive(): boolean;
}

interface OutboundMessage<K extends PlatformEventName> {
  readonly event: K;
  readonly payload: PlatformEventMap[K];
  readonly timestamp: string;
}

const BROADCAST_EVENTS: ReadonlyArray<PlatformEventName> = [
  "ORDER_CREATED",
  "ORDER_UPDATED",
  "ORDER_CANCELLED",
  "PAYMENT_COMPLETED",
  "PAYMENT_FAILED",
  "PAYMENT_REFUNDED",
  "MODULE_STARTED",
  "MODULE_ERROR",
  "SYNC_COMPLETED",
  "SYNC_FAILED",
  "PRINT_JOB_QUEUED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
  "PRODUCTION_CENTER_CREATED",
  "PRODUCTION_CENTER_UPDATED",
  "PRODUCTION_CENTER_DELETED",
  "OPTION_GROUP_CREATED",
  "OPTION_GROUP_UPDATED",
  "OPTION_GROUP_DELETED",
  "OPTION_CREATED",
  "OPTION_UPDATED",
  "OPTION_DELETED",
  "PAYMENT_METHOD_CREATED",
  "PAYMENT_METHOD_UPDATED",
  "PAYMENT_METHOD_DELETED",
  "PRINTER_CREATED",
  "PRINTER_UPDATED",
  "PRINTER_DELETED",
  "TERMINAL_CREATED",
  "TERMINAL_UPDATED",
  "TERMINAL_DELETED",
  "SHIFT_OPENED",
  "SHIFT_CLOSED",
  "SHIFT_UPDATED",
];

export class WsBroadcaster {
  private readonly clients = new Map<string, WsClient>();
  private readonly subscriptions: EventSubscription[] = [];

  constructor(private readonly eventBus: EventBus) {}

  start(): void {
    for (const eventName of BROADCAST_EVENTS) {
      const sub = this.eventBus.on(eventName, (payload) => {
        this.broadcast(eventName, payload);
      });
      this.subscriptions.push(sub);
    }
  }

  stop(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.clients.clear();
  }

  addClient(client: WsClient): void {
    this.clients.set(client.id, client);
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  clientCount(): number {
    return this.clients.size;
  }

  /** Send an event only to clients that belong to a specific terminal. */
  sendToTerminal<K extends PlatformEventName>(
    terminalId: string,
    event: K,
    payload: PlatformEventMap[K],
  ): void {
    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const dead: string[] = [];
    for (const [id, client] of this.clients) {
      if (client.terminalId !== terminalId) continue;
      if (!client.isAlive()) { dead.push(id); continue; }
      try { client.send(message); } catch { dead.push(id); }
    }
    for (const id of dead) this.clients.delete(id);
  }

  private broadcast<K extends PlatformEventName>(
    event: K,
    payload: PlatformEventMap[K]
  ): void {
    const message: OutboundMessage<K> = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    const serialized = JSON.stringify(message);
    const dead: string[] = [];

    for (const [id, client] of this.clients) {
      if (!client.isAlive()) {
        dead.push(id);
        continue;
      }
      try {
        client.send(serialized);
      } catch {
        dead.push(id);
      }
    }

    for (const id of dead) {
      this.clients.delete(id);
    }
  }
}
