import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  color:     text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  price:       real("price").notNull(),
  categoryId:  text("category_id").references(() => categories.id),
  active:      integer("active", { mode: "boolean" }).notNull().default(true),
  color:       text("color"),
  description: text("description"),
  imageData:   text("image_data"),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   integer("created_at"),
  updatedAt:   integer("updated_at"),
});

export const productionCenters = sqliteTable("production_centers", {
  id:    text("id").primaryKey(),
  name:  text("name").notNull(),
  color: text("color"),
});

export const productionCenterCategories = sqliteTable("production_center_categories", {
  productionCenterId: text("production_center_id").notNull().references(() => productionCenters.id, { onDelete: "cascade" }),
  categoryId:         text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
});

export const paymentMethods = sqliteTable("payment_methods", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  type:      text("type").notNull(),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  icon:      text("icon"),
});

export const printers = sqliteTable("printers", {
  id:              text("id").primaryKey(),
  name:            text("name").notNull(),
  type:            text("type").notNull().default("escpos"),
  connectionType:  text("connection_type").notNull().default("network"),
  host:            text("host"),
  port:            integer("port"),
  active:          integer("active", { mode: "boolean" }).notNull().default(true),
  receiptEnabled:  integer("receipt_enabled", { mode: "boolean" }).notNull().default(false),
  kitchenEnabled:  integer("kitchen_enabled", { mode: "boolean" }).notNull().default(false),
});

export const receiptTemplates = sqliteTable("receipt_templates", {
  id:              text("id").primaryKey(),
  name:            text("name").notNull(),
  headerText:      text("header_text"),
  footerText:      text("footer_text"),
  showLogo:        integer("show_logo", { mode: "boolean" }).notNull().default(false),
  showOrderNumber: integer("show_order_number", { mode: "boolean" }).notNull().default(true),
  showTimestamp:   integer("show_timestamp", { mode: "boolean" }).notNull().default(true),
  showPaymentMethod: integer("show_payment_method", { mode: "boolean" }).notNull().default(true),
  active:          integer("active", { mode: "boolean" }).notNull().default(true),
});

export const shifts = sqliteTable("shifts", {
  id:            text("id").primaryKey(),
  userId:        text("user_id").notNull(),
  openedAt:      integer("opened_at").notNull(),
  closedAt:      integer("closed_at"),
  openingCash:   real("opening_cash").notNull().default(0),
  closingCash:   real("closing_cash"),
  totalSales:    real("total_sales").notNull().default(0),
  totalOrders:   integer("total_orders").notNull().default(0),
  notes:         text("notes"),
});
