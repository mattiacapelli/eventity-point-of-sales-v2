import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { ReceiptRenderData } from "./image-receipt.renderer.js";
import type { KitchenRenderData } from "./kitchen-image.renderer.js";

const WORKER_PATH = join(dirname(fileURLToPath(import.meta.url)), "render-worker.js");

type PendingJob = {
  resolve: (buf: Buffer) => void;
  reject: (err: Error) => void;
};

type WorkerState = {
  worker: Worker;
  busy: boolean;
  pending: Map<number, PendingJob>;
};

type RenderReceiptInput = Omit<ReceiptRenderData, "paidAt"> & { paidAt: Date | string; canvasWidth: number };
type RenderKitchenInput = Omit<KitchenRenderData, "timestamp"> & { timestamp: Date | string };

export class RenderPool {
  private states: WorkerState[] = [];
  private queue: Array<() => void> = [];
  private nextId = 0;
  private nextWorker = 0;

  constructor(size = 2) {
    for (let i = 0; i < size; i++) {
      this.states.push(this.createState());
    }
  }

  private createState(): WorkerState {
    const worker = new Worker(WORKER_PATH);
    const state: WorkerState = { worker, busy: false, pending: new Map() };

    worker.on("message", (msg: { id: number; ok: boolean; buffer?: ArrayBuffer; error?: string }) => {
      const job = state.pending.get(msg.id);
      if (!job) return;
      state.pending.delete(msg.id);

      if (msg.ok && msg.buffer) {
        job.resolve(Buffer.from(msg.buffer));
      } else {
        job.reject(new Error(msg.error ?? "Render failed"));
      }

      state.busy = false;
      const next = this.queue.shift();
      if (next) next();
    });

    worker.on("error", (err) => {
      for (const job of state.pending.values()) job.reject(err);
      state.pending.clear();
      state.busy = false;
    });

    return state;
  }

  private pickFreeWorker(): WorkerState | undefined {
    for (let i = 0; i < this.states.length; i++) {
      const idx = (this.nextWorker + i) % this.states.length;
      const s = this.states[idx]!;
      if (!s.busy) {
        this.nextWorker = (idx + 1) % this.states.length;
        return s;
      }
    }
    return undefined;
  }

  private dispatch(state: WorkerState, msg: object, job: PendingJob): void {
    state.busy = true;
    state.pending.set((msg as { id: number }).id, job);
    state.worker.postMessage(msg);
  }

  renderReceipt(data: RenderReceiptInput): Promise<Buffer> {
    const id = this.nextId++;
    const paidAt = data.paidAt instanceof Date ? data.paidAt.toISOString() : data.paidAt;
    const msg = { id, type: "receipt" as const, canvasWidth: data.canvasWidth, data: { ...data, paidAt } };

    return new Promise<Buffer>((resolve, reject) => {
      const job: PendingJob = { resolve, reject };
      const state = this.pickFreeWorker();
      if (state) {
        this.dispatch(state, msg, job);
      } else {
        this.queue.push(() => {
          const s = this.pickFreeWorker()!;
          this.dispatch(s, msg, job);
        });
      }
    });
  }

  renderKitchen(data: RenderKitchenInput): Promise<Buffer> {
    const id = this.nextId++;
    const canvasWidth = (data as unknown as { canvasWidth?: number }).canvasWidth ?? 576;
    const timestamp = data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp;
    const msg = { id, type: "kitchen" as const, canvasWidth, data: { ...data, timestamp } };

    return new Promise<Buffer>((resolve, reject) => {
      const job: PendingJob = { resolve, reject };
      const state = this.pickFreeWorker();
      if (state) {
        this.dispatch(state, msg, job);
      } else {
        this.queue.push(() => {
          const s = this.pickFreeWorker()!;
          this.dispatch(s, msg, job);
        });
      }
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.states.map((s) => s.worker.terminate()));
  }
}

export const renderPool = new RenderPool(2);
