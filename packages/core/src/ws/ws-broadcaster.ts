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
  "MODULE_STARTED",
  "MODULE_ERROR",
  "SYNC_COMPLETED",
  "SYNC_FAILED",
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
