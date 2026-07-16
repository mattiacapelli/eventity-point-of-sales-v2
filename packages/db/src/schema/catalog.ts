import { sqliteTable, text, real, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:      text("name").notNull(),
  color:     text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id:                 integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:               text("name").notNull(),
  price:              real("price").notNull(),
  categoryId:         integer("category_id", { mode: "number" }).references(() => categories.id),
  productionCenterId: integer("production_center_id", { mode: "number" }).references(() => productionCenters.id),
  active:             integer("active", { mode: "boolean" }).notNull().default(true),
  color:              text("color"),
  description:        text("description"),
  imageData:          text("image_data"),
  sortOrder:          integer("sort_order").notNull().default(0),
  vatRate:            integer("vat_rate").notNull().default(10),
  receiptPrintMode:   text("receipt_print_mode").notNull().default("inherit"),
  availableDates:     text("available_dates"),
  createdAt:          integer("created_at"),
  updatedAt:          integer("updated_at"),
});

export const productionCenters = sqliteTable("production_centers", {
  id:               integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:             text("name").notNull(),
  color:            text("color"),
  icon:             text("icon"),
  receiptPrintMode: text("receipt_print_mode").notNull().default("included"),
  sortOrder:        integer("sort_order").notNull().default(0),
});

export const productionCenterCategories = sqliteTable("production_center_categories", {
  productionCenterId: integer("production_center_id", { mode: "number" }).notNull().references(() => productionCenters.id, { onDelete: "cascade" }),
  categoryId:         integer("category_id", { mode: "number" }).notNull().references(() => categories.id, { onDelete: "cascade" }),
});

export const paymentMethods = sqliteTable("payment_methods", {
  id:               text("id").primaryKey(),
  name:             text("name").notNull(),
  type:             text("type").notNull(),
  active:           integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder:        integer("sort_order").notNull().default(0),
  icon:             text("icon"),
  excludeFromTotal: integer("exclude_from_total", { mode: "boolean" }).notNull().default(false),
});

export const printers = sqliteTable("printers", {
  id:              integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:            text("name").notNull(),
  type:            text("type").notNull().default("escpos"),
  connectionType:  text("connection_type").notNull().default("network"),
  host:            text("host"),
  port:            integer("port"),
  usbVendorId:     integer("usb_vendor_id"),
  usbProductId:    integer("usb_product_id"),
  active:          integer("active", { mode: "boolean" }).notNull().default(true),
  receiptEnabled:  integer("receipt_enabled", { mode: "boolean" }).notNull().default(false),
  kitchenEnabled:  integer("kitchen_enabled", { mode: "boolean" }).notNull().default(false),
  printMode:       text("print_mode").notNull().default("text"),
}, (t) => ({
  hostPortUniq: uniqueIndex("printers_host_port_uniq").on(t.host, t.port),
}));

export const receiptTemplates = sqliteTable("receipt_templates", {
  id:              integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:            text("name").notNull(),
  headerText:      text("header_text"),
  footerText:      text("footer_text"),
  showLogo:        integer("show_logo", { mode: "boolean" }).notNull().default(false),
  showOrderNumber: integer("show_order_number", { mode: "boolean" }).notNull().default(true),
  showTimestamp:   integer("show_timestamp", { mode: "boolean" }).notNull().default(true),
  showPaymentMethod: integer("show_payment_method", { mode: "boolean" }).notNull().default(true),
  showItemCategory: integer("show_item_category", { mode: "boolean" }).notNull().default(false),
  active:          integer("active", { mode: "boolean" }).notNull().default(true),
  printMode:       text("print_mode").notNull().default("text"),
  canvasWidth:     integer("canvas_width").notNull().default(576),
  logoPath:        text("logo_path"),
  blocks:          text("blocks"),
  printMethod:     text("print_method").notNull().default("single"),
  role:            text("role").notNull().default("master"),
});

export const shifts = sqliteTable("shifts", {
  id:             integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId:         integer("user_id", { mode: "number" }).notNull(),
  openedAt:       integer("opened_at").notNull(),
  closedAt:       integer("closed_at"),
  openingCash:    real("opening_cash").notNull().default(0),
  closingCash:    real("closing_cash"),
  totalSales:     real("total_sales").notNull().default(0),
  totalOrders:    integer("total_orders").notNull().default(0),
  notes:          text("notes"),
  zReportFiscal:  text("z_report_fiscal"),
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
  productionCenterId: integer("production_center_id", { mode: "number" }).notNull().references(() => productionCenters.id, { onDelete: "cascade" }),
  printerId:          integer("printer_id", { mode: "number" }).notNull().references(() => printers.id, { onDelete: "cascade" }),
});

export const kitchenTemplates = sqliteTable("kitchen_templates", {
  id:                 integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:               text("name").notNull(),
  productionCenterId: integer("production_center_id", { mode: "number" }).references(() => productionCenters.id, { onDelete: "set null" }),
  active:             integer("active", { mode: "boolean" }).notNull().default(true),
  printMode:          text("print_mode").notNull().default("text"),
  canvasWidth:        integer("canvas_width").notNull().default(576),
  blocks:             text("blocks"),
  logoPath:           text("logo_path"),
});

export const shiftReportTemplates = sqliteTable("shift_report_templates", {
  id:          integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:        text("name").notNull(),
  active:      integer("active", { mode: "boolean" }).notNull().default(true),
  printMode:   text("print_mode").notNull().default("image"),
  canvasWidth: integer("canvas_width").notNull().default(576),
  blocks:      text("blocks"),
  logoPath:    text("logo_path"),
});

export const terminals = sqliteTable("terminals", {
  id:              integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:            text("name").notNull(),
  active:          integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt:       integer("created_at").notNull(),
  lastSeenAt:      integer("last_seen_at"),
  defaultViewMode: text("default_view_mode"),
});

export const terminalPrinters = sqliteTable("terminal_printers", {
  terminalId: integer("terminal_id", { mode: "number" }).notNull().references(() => terminals.id, { onDelete: "cascade" }),
  printerId:  integer("printer_id", { mode: "number" }).notNull().references(() => printers.id, { onDelete: "cascade" }),
});

export const terminalCategories = sqliteTable("terminal_categories", {
  terminalId: integer("terminal_id", { mode: "number" }).notNull().references(() => terminals.id, { onDelete: "cascade" }),
  categoryId: integer("category_id", { mode: "number" }).notNull().references(() => categories.id, { onDelete: "cascade" }),
  sortOrder:  integer("sort_order").notNull().default(0),
});

export const dailyExtras = sqliteTable("daily_extras", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  productId: integer("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
  date:      text("date").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniq: uniqueIndex("daily_extras_product_date_uniq").on(t.productId, t.date),
}));

export const productGridLayouts = sqliteTable("product_grid_layouts", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  scope:     text("scope").notNull(),
  productId: integer("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
  slotX:     integer("slot_x").notNull().default(0),
  slotY:     integer("slot_y").notNull().default(0),
  spanW:     integer("span_w").notNull().default(1),
  spanH:     integer("span_h").notNull().default(1),
});
