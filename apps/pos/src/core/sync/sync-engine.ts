import { randomUUID } from "node:crypto";
import type { IEventBus } from "@pos/event-bus";

export type SyncStatus = "idle" | "syncing" | "error";

export class SyncEngine {
  private status: SyncStatus = "idle";

  constructor(private readonly eventBus: IEventBus) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  async sync(): Promise<void> {
    if (this.status === "syncing") return;

    this.status = "syncing";
    this.eventBus.emit("SYNC_STARTED", {
      traceId: randomUUID(),
      timestamp: new Date(),
    });

    try {
      await this.performSync();
      this.status = "idle";
      this.eventBus.emit("SYNC_COMPLETED", {
        traceId: randomUUID(),
        syncedAt: new Date(),
        recordsSynced: 0,
      });
    } catch (err) {
      this.status = "error";
      const reason = err instanceof Error ? err.message : String(err);
      this.eventBus.emit("SYNC_FAILED", {
        traceId: randomUUID(),
        reason,
        timestamp: new Date(),
      });
    }
  }

  private async performSync(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}
