import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { terminals, productionCenters } from "./catalog.js";

export const orders = sqliteTable("orders", {
  id:            integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  tableId:       text("table_id"),
  customerName:  text("customer_name"),
  eventId:       text("event_id"),
  shiftId:       integer("shift_id", { mode: "number" }),
  terminalId:    integer("terminal_id", { mode: "number" }).references(() => terminals.id),
  status: text("status", {
    enum: ["pending", "confirmed", "preparing", "ready", "completed", "cancelled", "refunded"],
  }).notNull().default("pending"),
  totalAmount:    real("total_amount").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  discountType:   text("discount_type"),
  notes:          text("notes"),
  pax:            integer("pax"),
  receiptNumber:  integer("receipt_number"),
  fiscalDocNumber: text("fiscal_doc_number"),
  fiscalDocDate:  text("fiscal_doc_date"),
  fiscalRtSerial: text("fiscal_rt_serial"),
  createdAt:      integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt:      integer("updated_at", { mode: "timestamp" }).notNull(),
  syncedAt:       integer("synced_at", { mode: "timestamp" }),
}, (t) => ({
  shiftIdx:     index("orders_shift_id_idx").on(t.shiftId),
  createdAtIdx: index("orders_created_at_idx").on(t.createdAt),
  statusIdx:    index("orders_status_idx").on(t.status),
}));

export const orderItems = sqliteTable("order_items", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  orderId:   integer("order_id", { mode: "number" }).notNull().references(() => orders.id),
  productId: integer("product_id", { mode: "number" }).notNull(),
  name:      text("name").notNull(),
  quantity:  integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  notes:     text("notes"),
}, (t) => ({
  orderIdIdx: index("order_items_order_id_idx").on(t.orderId),
}));

export const orderItemOptions = sqliteTable("order_item_options", {
  id:          integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  orderItemId: integer("order_item_id", { mode: "number" }).notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  optionId:    integer("option_id", { mode: "number" }).notNull(),
  optionName:  text("option_name").notNull(),
  priceDelta:  real("price_delta").notNull().default(0),
});

export const orderCenterNumbers = sqliteTable("order_center_numbers", {
  orderId:             integer("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productionCenterId:  integer("production_center_id", { mode: "number" }).notNull().references(() => productionCenters.id, { onDelete: "cascade" }),
  centerNumber:        integer("center_number").notNull(),
});

export type DbOrder = typeof orders.$inferSelect;
export type DbOrderInsert = typeof orders.$inferInsert;
export type DbOrderItem = typeof orderItems.$inferSelect;
export type DbOrderItemInsert = typeof orderItems.$inferInsert;
export type DbOrderItemOption = typeof orderItemOptions.$inferSelect;
