import { fileURLToPath } from "node:url";
import type { ReceiptRenderData } from "./image-receipt.renderer.js";
import type { KitchenRenderData } from "./kitchen-image.renderer.js";

// In dev (tsx) import.meta.url points to the .ts source — Worker Threads
// cannot resolve the .js-aliased internal imports, so we skip the pool and
// render inline on the event loop instead. In production the compiled .js
// workers run normally.
const __file  = fileURLToPath(import.meta.url);
const isDev   = __file.endsWith(".ts");

type RenderReceiptInput = Omit<ReceiptRenderData, "paidAt"> & { paidAt: Date | string; canvasWidth: number };
type RenderKitchenInput = Omit<KitchenRenderData, "timestamp"> & { timestamp: Date | string; canvasWidth?: number };

// ── Dev path: inline rendering ────────────────────────────────────────────────

async function renderReceiptInline(data: RenderReceiptInput): Promise<Buffer> {
  const { renderReceiptImage } = await import("./image-receipt.renderer.js");
  const { pngToEscposRaster }  = await import("./raster.encoder.js");
  const png = await renderReceiptImage({ ...data, paidAt: new Date(data.paidAt) });
  return pngToEscposRaster(png, data.canvasWidth);
}

async function renderKitchenInline(data: RenderKitchenInput): Promise<Buffer> {
  const { renderKitchenImage } = await import("./kitchen-image.renderer.js");
  const { pngToEscposRaster }  = await import("./raster.encoder.js");
  const canvasWidth = data.canvasWidth ?? 576;
  const png = await renderKitchenImage({ ...data, timestamp: new Date(data.timestamp) });
  return pngToEscposRaster(png, canvasWidth);
}

// ── Prod path: Worker Thread pool ─────────────────────────────────────────────

type PendingJob = { resolve: (buf: Buffer) => void; reject: (err: Error) => void };
type WorkerState = { worker: import("node:worker_threads").Worker; busy: boolean; pending: Map<number, PendingJob> };

class RenderPool {
  private states: WorkerState[] = [];
  private queue: Array<() => void> = [];
  private nextId = 0;
  private nextWorker = 0;
  private workerPath: string;

  constructor(private readonly size = 2) {
    const { join, dirname } = require("node:path") as typeof import("node:path");
    this.workerPath = join(dirname(__file), "render-worker.js");
    for (let i = 0; i < size; i++) this.states.push(this.createState());
  }

  private createState(): WorkerState {
    const { Worker } = require("node:worker_threads") as typeof import("node:worker_threads");
    const worker = new Worker(this.workerPath);
    const state: WorkerState = { worker, busy: false, pending: new Map() };

    worker.on("message", (msg: { id: number; ok: boolean; buffer?: ArrayBuffer; error?: string }) => {
      const job = state.pending.get(msg.id);
      if (!job) return;
      state.pending.delete(msg.id);
      if (msg.ok && msg.buffer) job.resolve(Buffer.from(msg.buffer));
      else job.reject(new Error(msg.error ?? "Render failed"));
      state.busy = false;
      this.queue.shift()?.();
    });

    worker.on("error", (err) => {
      console.error("[render-pool] worker error:", err);
      for (const job of state.pending.values()) job.reject(err);
      state.pending.clear();
      state.busy = false;
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[render-pool] worker exited with code ${code}`);
        for (const job of state.pending.values()) job.reject(new Error(`Worker exited with code ${code}`));
        state.pending.clear();
        state.busy = false;
        const idx = this.states.indexOf(state);
        if (idx !== -1) this.states[idx] = this.createState();
      }
    });

    return state;
  }

  private pickFree(): WorkerState | undefined {
    for (let i = 0; i < this.states.length; i++) {
      const idx = (this.nextWorker + i) % this.states.length;
      const s = this.states[idx]!;
      if (!s.busy) { this.nextWorker = (idx + 1) % this.states.length; return s; }
    }
    return undefined;
  }

  private dispatch(state: WorkerState, msg: object, job: PendingJob): void {
    state.busy = true;
    state.pending.set((msg as { id: number }).id, job);
    state.worker.postMessage(msg);
  }

  send(msg: object): Promise<Buffer> {
    const id = this.nextId++;
    const m = { ...(msg as object), id };
    return new Promise<Buffer>((resolve, reject) => {
      const job: PendingJob = { resolve, reject };
      const state = this.pickFree();
      if (state) this.dispatch(state, m, job);
      else this.queue.push(() => this.dispatch(this.pickFree()!, m, job));
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.states.map((s) => s.worker.terminate()));
  }
}

// Lazy-init prod pool so the Worker import never runs in dev
let _pool: RenderPool | null = null;
function getPool(): RenderPool {
  if (!_pool) _pool = new RenderPool(2);
  return _pool;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const renderPool = {
  renderReceipt(data: RenderReceiptInput): Promise<Buffer> {
    if (isDev) return renderReceiptInline(data);
    const paidAt = data.paidAt instanceof Date ? data.paidAt.toISOString() : data.paidAt;
    return getPool().send({ type: "receipt", canvasWidth: data.canvasWidth, data: { ...data, paidAt } });
  },

  renderKitchen(data: RenderKitchenInput): Promise<Buffer> {
    if (isDev) return renderKitchenInline(data);
    const canvasWidth = data.canvasWidth ?? 576;
    const timestamp = data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp;
    return getPool().send({ type: "kitchen", canvasWidth, data: { ...data, timestamp } });
  },

  async shutdown(): Promise<void> {
    await _pool?.shutdown();
  },
};
