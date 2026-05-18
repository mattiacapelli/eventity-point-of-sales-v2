import type { IEventBus } from "@pos/event-bus";
import { PrintQueue } from "./jobs/print-queue.js";

export class PrinterService {
  private readonly queue = new PrintQueue();
  private running = false;
  private intervalHandle?: NodeJS.Timeout;

  constructor(private readonly eventBus: IEventBus) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    this.eventBus.on("PRINT_JOB_QUEUED", (payload) => {
      this.queue.enqueue({
        id: payload.jobId,
        type: payload.type,
        payload: payload.payload,
        queuedAt: payload.timestamp,
      });
    });

    this.intervalHandle = setInterval(() => void this.processNext(), 500);
    console.log("[PrinterService] Started — polling for jobs every 500ms");
  }

  stop(): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
    }
    this.running = false;
    console.log("[PrinterService] Stopped");
  }

  private async processNext(): Promise<void> {
    const job = this.queue.dequeue();
    if (job === undefined) return;

    job.status = "printing";
    console.log(`[PrinterService] Processing job: ${job.id} (${job.type})`);

    try {
      await this.simulatePrint(job.id, job.type);
      this.queue.markDone(job.id);
      console.log(`[PrinterService] Job done: ${job.id}`);
    } catch (err) {
      this.queue.markFailed(job.id);
      console.error(`[PrinterService] Job failed: ${job.id}`, err);
    }
  }

  private simulatePrint(_jobId: string, _type: string): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }
}
