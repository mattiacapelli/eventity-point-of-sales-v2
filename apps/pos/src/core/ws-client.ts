import type { PlatformEventMap, PlatformEventName } from "@pos/shared-types";
import { useStore } from "../state/global-store.js";
import { useTerminalStore } from "../state/terminal-store.js";

type WsMessage<K extends PlatformEventName = PlatformEventName> = {
  event: K;
  payload: PlatformEventMap[K];
  timestamp: string;
};

type Handler<K extends PlatformEventName> = (payload: PlatformEventMap[K]) => void;
type AnyHandler = (payload: unknown) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<PlatformEventName, Set<AnyHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = 1000;
  private url: string | null = null;
  private token: string | null = null;

  connect(url: string, token: string, terminalId?: string): void {
    this.url = url;
    this.token = token;
    if (terminalId !== undefined) {
      this._terminalId = terminalId;
    }
    this.open();
  }

  private _terminalId: string | null = null;

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    useStore.getState().setWsStatus("disconnected");
  }

  on<K extends PlatformEventName>(event: K, handler: Handler<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  off<K extends PlatformEventName>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as AnyHandler);
  }

  private open(): void {
    if (!this.url) return;
    useStore.getState().setWsStatus("connecting");

    const terminalId = this._terminalId ?? useTerminalStore.getState().terminalId;
    const qs = new URLSearchParams();
    if (this.token) qs.set("token", this.token);
    if (terminalId) qs.set("terminalId", terminalId);
    const wsUrl = qs.toString() ? `${this.url}?${qs}` : this.url;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      useStore.getState().setWsStatus("connected");
      this.reconnectDelay = 1000;
      // Heartbeat: send ping every 30s to keep the connection alive
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30_000);
    };

    this.ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        const handlers = this.listeners.get(msg.event);
        if (handlers) {
          for (const h of handlers) h(msg.payload);
        }
      } catch {
        // malformed frame — ignore
      }
    };

    this.ws.onerror = () => {
      // onclose will follow
    };

    this.ws.onclose = () => {
      useStore.getState().setWsStatus("disconnected");
      if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.url) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this.open();
    }, this.reconnectDelay);
  }
}

export const wsClient = new WsClient();
