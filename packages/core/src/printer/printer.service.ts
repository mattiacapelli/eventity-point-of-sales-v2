import type { Logger } from "pino";
import { TcpPrinterAdapter } from "./tcp-printer.adapter.js";

export interface PrintJob {
  printerId: string;
  content: string;
  type: "receipt" | "kitchen";
}

export interface PrintResult {
  success: boolean;
  message: string;
}

export interface PrinterAdapter {
  print(job: PrintJob): Promise<PrintResult>;
}

export interface PrinterConfig {
  host: string;
  port: number;
}

class MockPrinterAdapter implements PrinterAdapter {
  constructor(private readonly logger: Logger) {}

  async print(job: PrintJob): Promise<PrintResult> {
    this.logger.info({ printerId: job.printerId, type: job.type, bytes: job.content.length }, "[printer] mock print");
    return { success: true, message: "Mock print OK" };
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PrinterService {
  private readonly adapter: PrinterAdapter;
  private readonly queue: PrintJob[] = [];
  private readonly deadLetterQueue: PrintJob[] = [];
  private processing = false;

  constructor(logger: Logger, config?: PrinterConfig) {
    if (config?.host) {
      this.adapter = new TcpPrinterAdapter(config.host, config.port, logger);
    } else {
      this.adapter = new MockPrinterAdapter(logger);
    }
  }

  enqueue(job: PrintJob): void {
    this.queue.push(job);
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await this.printWithRetry(job);
    }
    this.processing = false;
  }

  private async printWithRetry(job: PrintJob): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.adapter.print(job);
        if (result.success) return;
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
      } catch {
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
      }
    }
    // All retries exhausted — send to dead-letter queue
    this.deadLetterQueue.push(job);
  }

  async printDirect(job: PrintJob): Promise<PrintResult> {
    return this.adapter.print(job);
  }

  getDeadLetterQueue(): readonly PrintJob[] {
    return this.deadLetterQueue;
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }
}
