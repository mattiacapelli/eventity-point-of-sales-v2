// NOTE: a partial unique index should also exist at DB level to prevent double-payment
// under concurrent writes. Add via migration:
//   CREATE UNIQUE INDEX IF NOT EXISTS payments_order_completed_idx
//   ON payments(order_id) WHERE status = 'completed';
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { orders } from "./orders.js";
import { terminals } from "./catalog.js";

export const payments = sqliteTable("payments", {
  id:         integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  orderId:    integer("order_id", { mode: "number" }).notNull().references(() => orders.id),
  method:     text("method").notNull(),
  status: text("status", {
    enum: ["pending", "completed", "failed", "refunded"],
  }).notNull().default("pending"),
  amount:     real("amount").notNull(),
  currency:   text("currency").notNull().default("EUR"),
  reference:  text("reference"),
  terminalId: integer("terminal_id", { mode: "number" }).references(() => terminals.id),
  createdAt:  integer("created_at", { mode: "timestamp" }).notNull(),
  syncedAt:   integer("synced_at", { mode: "timestamp" }),
});

export type DbPayment = typeof payments.$inferSelect;
export type DbPaymentInsert = typeof payments.$inferInsert;
