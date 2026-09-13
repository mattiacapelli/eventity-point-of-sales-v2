import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const printLog = sqliteTable("print_log", {
  id:             integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  ts:             integer("ts", { mode: "timestamp" }).notNull(),
  orderId:        integer("order_id", { mode: "number" }),
  jobType:        text("job_type", { enum: ["kitchen", "receipt"] }).notNull(),
  // printer
  printerId:      integer("printer_id", { mode: "number" }),
  printerName:    text("printer_name"),
  connectionType: text("connection_type"),
  printerHost:    text("printer_host"),
  printerPort:    integer("printer_port", { mode: "number" }),
  // origin
  terminalId:     integer("terminal_id", { mode: "number" }),
  terminalIp:     text("terminal_ip"),
  // event
  event:          text("event", {
    enum: ["queued", "rendering", "sent", "ok", "retry", "failed", "offline_fast_fail"],
  }).notNull(),
  attempt:        integer("attempt", { mode: "number" }),
  errorMsg:       text("error_msg"),
  centerName:     text("center_name"),
  bytes:          integer("bytes", { mode: "number" }),
}, (t) => ({
  orderIdx: index("print_log_order_id_idx").on(t.orderId),
  tsIdx:    index("print_log_ts_idx").on(t.ts),
}));
