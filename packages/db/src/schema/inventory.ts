import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { products } from "./catalog.js";
import { orders } from "./orders.js";

export const inventoryItems = sqliteTable("inventory_items", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  sku:                text("sku"),
  unit:               text("unit").notNull().default("pz"),
  currentStock:       real("current_stock").notNull().default(0),
  minStock:           real("min_stock").notNull().default(0),
  productionCenterId: text("production_center_id"),
  productId:          text("product_id").references(() => products.id),
  resetOnShiftOpen:   integer("reset_on_shift_open").notNull().default(0),
  createdAt:          integer("created_at").notNull(),
  updatedAt:          integer("updated_at").notNull(),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id:        text("id").primaryKey(),
  itemId:    text("item_id").notNull().references(() => inventoryItems.id),
  type:      text("type", { enum: ["sale", "restock", "manual", "waste"] }).notNull(),
  quantity:  real("quantity").notNull(),
  reason:    text("reason"),
  orderId:   text("order_id").references(() => orders.id),
  createdAt: integer("created_at").notNull(),
});

export const productIngredients = sqliteTable("product_ingredients", {
  id:              text("id").primaryKey(),
  productId:       text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  quantity:        real("quantity").notNull().default(1),
});
