import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { orders } from "./orders.js";
import { terminals } from "./catalog.js";

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  method: text("method", {
    enum: ["cash", "card", "digital_wallet", "tab"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "completed", "failed", "refunded"],
  }).notNull().default("pending"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("EUR"),
  reference: text("reference"),
  terminalId: text("terminal_id").references(() => terminals.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
});

export type DbPayment = typeof payments.$inferSelect;
export type DbPaymentInsert = typeof payments.$inferInsert;
