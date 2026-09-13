import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { products } from "./catalog.js";

export const optionGroups = sqliteTable("option_groups", {
  id:           integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  productId:    integer("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  type:         text("type").notNull(),   // 'single' | 'multi' | 'removal'
  required:     integer("required", { mode: "boolean" }).notNull().default(false),
  minSel:       integer("min_sel").notNull().default(0),
  maxSel:       integer("max_sel").notNull().default(1),
  sortOrder:    integer("sort_order").notNull().default(0),
});

export const options = sqliteTable("options", {
  id:            integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  optionGroupId: integer("option_group_id", { mode: "number" }).notNull().references(() => optionGroups.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  priceDelta:    real("price_delta").notNull().default(0),
  prefix:        text("prefix").notNull().default("+"),  // "+" | "-" | ">>"
  active:        integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder:     integer("sort_order").notNull().default(0),
});
