import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { products } from "./catalog.js";
import { orders } from "./orders.js";

export const inventoryItems = sqliteTable("inventory_items", {
  id:                 integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:               text("name").notNull(),
  sku:                text("sku"),
  unit:               text("unit").notNull().default("pz"),
  currentStock:       real("current_stock").notNull().default(0),
  minStock:           real("min_stock").notNull().default(0),
  productionCenterId: integer("production_center_id", { mode: "number" }),
  productId:          integer("product_id", { mode: "number" }).references(() => products.id),
  resetOnShiftOpen:   integer("reset_on_shift_open").notNull().default(0),
  createdAt:          integer("created_at").notNull(),
  updatedAt:          integer("updated_at").notNull(),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  itemId:    integer("item_id", { mode: "number" }).notNull().references(() => inventoryItems.id),
  type:      text("type", { enum: ["sale", "restock", "manual", "waste"] }).notNull(),
  quantity:  real("quantity").notNull(),
  reason:    text("reason"),
  orderId:   integer("order_id", { mode: "number" }).references(() => orders.id),
  createdAt: integer("created_at").notNull(),
});

export const productIngredients = sqliteTable("product_ingredients", {
  id:              integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  productId:       integer("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id", { mode: "number" }).notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  quantity:        real("quantity").notNull().default(1),
});
