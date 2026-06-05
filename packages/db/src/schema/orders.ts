import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  tableId: text("table_id"),
  eventId: text("event_id"),
  shiftId: text("shift_id"),
  status: text("status", {
    enum: ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"],
  }).notNull().default("pending"),
  totalAmount: real("total_amount").notNull().default(0),
  receiptNumber: integer("receipt_number"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
}, (t) => ({
  shiftIdx:     index("orders_shift_id_idx").on(t.shiftId),
  createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
  statusIdx:    index("orders_status_idx").on(t.status),
}));

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  notes: text("notes"),
}, (t) => ({
  orderIdIdx: index("order_items_order_id_idx").on(t.orderId),
}));

export const orderItemOptions = sqliteTable("order_item_options", {
  id:          text("id").primaryKey(),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  optionId:    text("option_id").notNull(),
  optionName:  text("option_name").notNull(),
  priceDelta:  real("price_delta").notNull().default(0),
});

export type DbOrder = typeof orders.$inferSelect;
export type DbOrderInsert = typeof orders.$inferInsert;
export type DbOrderItem = typeof orderItems.$inferSelect;
export type DbOrderItemInsert = typeof orderItems.$inferInsert;
export type DbOrderItemOption = typeof orderItemOptions.$inferSelect;
