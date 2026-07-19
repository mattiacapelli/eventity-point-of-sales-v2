import { printLog } from "./schema/print-log.js";
import type { DbClient } from "./client.js";

export type PrintLogEvent =
  | "queued"
  | "rendering"
  | "sent"
  | "ok"
  | "retry"
  | "failed"
  | "offline_fast_fail";

export type PrintLogEntry = {
  orderId?: number | undefined;
  jobType: "kitchen" | "receipt";
  printerId?: number | undefined;
  printerName?: string | undefined;
  connectionType?: string | undefined;
  printerHost?: string | undefined;
  printerPort?: number | undefined;
  terminalId?: number | undefined;
  terminalIp?: string | undefined;
  event: PrintLogEvent;
  attempt?: number | undefined;
  errorMsg?: string | undefined;
  centerName?: string | undefined;
  bytes?: number | undefined;
};

/** Fire-and-forget — never throws, never blocks the caller. */
export function logPrint(db: DbClient, entry: PrintLogEntry): void {
  void db.insert(printLog).values({
    ts:             new Date(),
    orderId:        entry.orderId ?? null,
    jobType:        entry.jobType,
    printerId:      entry.printerId ?? null,
    printerName:    entry.printerName ?? null,
    connectionType: entry.connectionType ?? null,
    printerHost:    entry.printerHost ?? null,
    printerPort:    entry.printerPort ?? null,
    terminalId:     entry.terminalId ?? null,
    terminalIp:     entry.terminalIp ?? null,
    event:          entry.event,
    attempt:        entry.attempt ?? null,
    errorMsg:       entry.errorMsg ?? null,
    centerName:     entry.centerName ?? null,
    bytes:          entry.bytes ?? null,
  }).catch(() => { /* log failure must never surface */ });
}
