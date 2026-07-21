import type { Logger } from "pino";
import { TcpPrinterAdapter } from "./tcp-printer.adapter.js";
import { UsbPrinterAdapter } from "./usb-printer.adapter.js";
import { WindowsPrinterAdapter } from "./windows-printer.adapter.js";

export interface PrintJob {
  printerId: number;
  /** Plain text content (text mode). Mutually exclusive with contentBuffer. */
  content?: string;
  /** Raw bytes to write directly (image/raster mode). Mutually exclusive with content. */
  contentBuffer?: Buffer;
  type: "receipt" | "kitchen";
  /** If provided, a TCP adapter is created/reused for this printer. */
  printerConfig?: PrinterConfig;
}

export interface PrintResult {
  success: boolean;
  message: string;
}

export interface PrinterAdapter {
  print(job: PrintJob): Promise<PrintResult>;
}

export interface PrinterConfig {
  connectionType?: "network" | "usb" | "windows";
  // network
  host?: string;
  port?: number;
  // usb
  usbVendorId?: number;
  usbProductId?: number;
  // windows
  winPrinterName?: string;
}

class MockPrinterAdapter implements PrinterAdapter {
  constructor(private readonly logger: Logger) {}

  async print(job: PrintJob): Promise<PrintResult> {
    const bytes = job.contentBuffer?.length ?? job.content?.length ?? 0;
    this.logger.info({ printerId: job.printerId, type: job.type, bytes }, "[printer] mock print");
    return { success: true, message: "Mock print OK" };
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const PRINT_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then(() => fallback),
  ]);
}

/** Resolves with true if the promise settled within ms, false if it timed out. */
function raceTimeout(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let settled = false;
  return Promise.race([
    promise.then(() => { settled = true; return true; }, () => { settled = true; return true; }),
    sleep(ms).then(() => settled),
  ]);
}

export class PrinterService {
  private readonly fallbackAdapter: PrinterAdapter;
  private readonly adapterPool = new Map<string, PrinterAdapter>();
  private readonly deadLetterQueue: PrintJob[] = [];
  /** Per-printer serialization chain — prevents concurrent writes to the same device. */
  private readonly printChain = new Map<string, Promise<void>>();

  constructor(private readonly logger: Logger) {
    this.fallbackAdapter = new MockPrinterAdapter(logger);
  }

  /** Get or create an adapter for a given printerId + config (TCP or USB). */
  private getAdapter(job: PrintJob): PrinterAdapter {
    const cfg = job.printerConfig;
    if (!cfg) return this.fallbackAdapter;

    if (cfg.connectionType === "usb") {
      if (!cfg.usbVendorId || !cfg.usbProductId) return this.fallbackAdapter;
      const key = `usb:${job.printerId}:${cfg.usbVendorId}:${cfg.usbProductId}`;
      let adapter = this.adapterPool.get(key);
      if (!adapter) {
        adapter = new UsbPrinterAdapter(cfg.usbVendorId, cfg.usbProductId, this.logger);
        this.adapterPool.set(key, adapter);
      }
      return adapter;
    }

    if (cfg.connectionType === "windows") {
      if (!cfg.winPrinterName) return this.fallbackAdapter;
      const key = `win:${job.printerId}:${cfg.winPrinterName}`;
      let adapter = this.adapterPool.get(key);
      if (!adapter) {
        adapter = new WindowsPrinterAdapter(cfg.winPrinterName, this.logger);
        this.adapterPool.set(key, adapter);
      }
      return adapter;
    }

    if (!cfg.host || !cfg.port) return this.fallbackAdapter;
    const key = `tcp:${job.printerId}:${cfg.host}:${cfg.port}`;
    let adapter = this.adapterPool.get(key);
    if (!adapter) {
      adapter = new TcpPrinterAdapter(cfg.host, cfg.port, this.logger);
      this.adapterPool.set(key, adapter);
    }
    return adapter;
  }

  /** Abort the adapter's current socket if the adapter supports it (TCP only). */
  private abortAdapter(job: PrintJob): void {
    const cfg = job.printerConfig;
    if (!cfg || cfg.connectionType === "usb" || cfg.connectionType === "windows") return;
    if (!cfg.host || !cfg.port) return;
    const key = `tcp:${job.printerId}:${cfg.host}:${cfg.port}`;
    const adapter = this.adapterPool.get(key);
    if (adapter && "abortCurrentSocket" in adapter) {
      (adapter as TcpPrinterAdapter).abortCurrentSocket();
    }
  }

  enqueue(job: PrintJob): void {
    // Route into the per-printer chain so jobs for different printers run in
    // parallel while jobs for the same printer remain serialized.
    void this.printWithRetry(job);
  }

  private async printWithRetry(job: PrintJob): Promise<void> {
    const key = this.adapterKey(job);
    const prev = this.printChain.get(key) ?? Promise.resolve();
    let resolve!: () => void;
    const next = new Promise<void>((r) => { resolve = r; });
    this.printChain.set(key, next);
    try {
      const prevSettled = await raceTimeout(prev, PRINT_TIMEOUT_MS);
      if (!prevSettled) {
        this.abortAdapter(job);
      }
      const adapter = this.getAdapter(job);
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await withTimeout(adapter.print(job), PRINT_TIMEOUT_MS, { success: false, message: "timeout" });
          if (result.success) return;
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        } catch {
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        }
      }
      this.deadLetterQueue.push(job);
    } finally {
      resolve();
      if (this.printChain.get(key) === next) this.printChain.delete(key);
    }
  }

  async printDirect(job: PrintJob): Promise<PrintResult> {
    const key = this.adapterKey(job);
    const prev = this.printChain.get(key) ?? Promise.resolve();
    let resolve!: () => void;
    const next = new Promise<void>((r) => { resolve = r; });
    this.printChain.set(key, next);
    try {
      // Await the previous job in the chain, but never block longer than the
      // print timeout — a permanently-hung job must not freeze all successors.
      const prevSettled = await raceTimeout(prev, PRINT_TIMEOUT_MS);
      if (!prevSettled) {
        // Previous job timed out while still writing. Destroy the socket so
        // its in-flight bytes don't contaminate this job's stream.
        this.abortAdapter(job);
      }
      return await withTimeout(
        this.getAdapter(job).print(job),
        PRINT_TIMEOUT_MS,
        { success: false, message: `Print timeout after ${PRINT_TIMEOUT_MS}ms` },
      );
    } finally {
      resolve();
      if (this.printChain.get(key) === next) this.printChain.delete(key);
    }
  }

  private adapterKey(job: PrintJob): string {
    const cfg = job.printerConfig;
    if (!cfg) return `fallback:${job.printerId}`;
    if (cfg.connectionType === "usb") return `usb:${job.printerId}`;
    if (cfg.connectionType === "windows") return `win:${job.printerId}`;
    return `tcp:${job.printerId}`;
  }

  getDeadLetterQueue(): readonly PrintJob[] {
    return this.deadLetterQueue;
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }

  destroyAdapterPool(): void {
    for (const adapter of this.adapterPool.values()) {
      if ("destroy" in adapter && typeof (adapter as { destroy?: () => void }).destroy === "function") {
        (adapter as { destroy: () => void }).destroy();
      }
    }
    this.adapterPool.clear();
  }
}
