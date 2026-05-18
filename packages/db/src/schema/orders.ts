import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  tableId: text("table_id"),
  eventId: text("event_id"),
  status: text("status", {
    enum: ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"],
  }).notNull().default("pending"),
  totalAmount: real("total_amount").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  notes: text("notes"),
});

export type DbOrder = typeof orders.$inferSelect;
export type DbOrderInsert = typeof orders.$inferInsert;
export type DbOrderItem = typeof orderItems.$inferSelect;
export type DbOrderItemInsert = typeof orderItems.$inferInsert;
