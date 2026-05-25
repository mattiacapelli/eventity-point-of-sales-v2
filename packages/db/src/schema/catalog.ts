import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  color:     text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  price:              real("price").notNull(),
  categoryId:         text("category_id").references(() => categories.id),
  productionCenterId: text("production_center_id").references(() => productionCenters.id),
  active:             integer("active", { mode: "boolean" }).notNull().default(true),
  color:              text("color"),
  description:        text("description"),
  imageData:          text("image_data"),
  sortOrder:          integer("sort_order").notNull().default(0),
  createdAt:          integer("created_at"),
  updatedAt:          integer("updated_at"),
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
  printMode:       text("print_mode").notNull().default("text"),
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
  printMode:       text("print_mode").notNull().default("text"),
  canvasWidth:     integer("canvas_width").notNull().default(576),
  logoPath:        text("logo_path"),
  blocks:          text("blocks"),
  printMethod:     text("print_method").notNull().default("single"),
  role:            text("role").notNull().default("master"),
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

export const appSettings = sqliteTable("app_settings", {
  key:   text("key").primaryKey(),
  value: text("value").notNull(),
});

export const modules = sqliteTable("modules", {
  name:      text("name").primaryKey(),
  enabled:   integer("enabled", { mode: "boolean" }).notNull().default(true),
  version:   text("version").notNull().default("0.1.0"),
  config:    text("config"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const receiptCounters = sqliteTable("receipt_counters", {
  scope:     text("scope").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
});

export const productionCenterPrinters = sqliteTable("production_center_printers", {
  productionCenterId: text("production_center_id").notNull().references(() => productionCenters.id, { onDelete: "cascade" }),
  printerId:          text("printer_id").notNull().references(() => printers.id, { onDelete: "cascade" }),
});

export const kitchenTemplates = sqliteTable("kitchen_templates", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  productionCenterId: text("production_center_id").references(() => productionCenters.id, { onDelete: "set null" }),
  active:             integer("active", { mode: "boolean" }).notNull().default(true),
  printMode:          text("print_mode").notNull().default("text"),
  canvasWidth:        integer("canvas_width").notNull().default(576),
  blocks:             text("blocks"),
  logoPath:           text("logo_path"),
});

export const terminals = sqliteTable("terminals", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull(),
  active:     integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt:  integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at"),
});

export const terminalPrinters = sqliteTable("terminal_printers", {
  terminalId: text("terminal_id").notNull().references(() => terminals.id, { onDelete: "cascade" }),
  printerId:  text("printer_id").notNull().references(() => printers.id, { onDelete: "cascade" }),
});

export const productGridLayouts = sqliteTable("product_grid_layouts", {
  id:        text("id").primaryKey(),
  scope:     text("scope").notNull(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  slotX:     integer("slot_x").notNull().default(0),
  slotY:     integer("slot_y").notNull().default(0),
  spanW:     integer("span_w").notNull().default(1),
  spanH:     integer("span_h").notNull().default(1),
});
