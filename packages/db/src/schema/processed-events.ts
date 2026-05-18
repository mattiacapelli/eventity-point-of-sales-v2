import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Tracks event traceIds that have already been processed by a specific handler.
 * Insert-or-ignore pattern: if the row exists, the handler is a duplicate and must be skipped.
 */
export const processedEvents = sqliteTable("processed_events", {
  handlerId: text("handler_id").notNull(),
  traceId:   text("trace_id").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }).notNull(),
});
