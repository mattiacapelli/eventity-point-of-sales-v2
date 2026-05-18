export type PrintJobType = "receipt" | "kitchen_ticket" | "report";

export interface PrintJob {
  readonly id: string;
  readonly type: PrintJobType;
  readonly payload: unknown;
  readonly queuedAt: Date;
  status: "queued" | "printing" | "done" | "failed";
}

export class PrintQueue {
  private readonly queue: PrintJob[] = [];

  enqueue(job: Omit<PrintJob, "status">): void {
    this.queue.push({ ...job, status: "queued" });
    console.log(`[PrintQueue] Job enqueued: ${job.id} (${job.type})`);
  }

  dequeue(): PrintJob | undefined {
    return this.queue.find((j) => j.status === "queued");
  }

  markDone(id: string): void {
    const job = this.queue.find((j) => j.id === id);
    if (job !== undefined) job.status = "done";
  }

  markFailed(id: string): void {
    const job = this.queue.find((j) => j.id === id);
    if (job !== undefined) job.status = "failed";
  }

  size(): number {
    return this.queue.filter((j) => j.status === "queued").length;
  }
}
