import { sqliteTable, text, real, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id:        text("id").primaryKey(),
  slug:      text("slug").notNull(),
  name:      text("name").notNull(),
  apiKey:    text("api_key").notNull(),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  slugUniq: uniqueIndex("tenants_slug_uniq").on(t.slug),
}));

export const categories = sqliteTable("categories", {
  id:        text("id").primaryKey(),
  tenantId:  text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = sqliteTable("products", {
  id:         text("id").primaryKey(),
  tenantId:   text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  price:      real("price").notNull(),
  active:     integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder:  integer("sort_order").notNull().default(0),
});

export const optionGroups = sqliteTable("option_groups", {
  id:        text("id").primaryKey(),
  tenantId:  text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  type:      text("type").notNull(), // "single" | "multi" | "removal"
  required:  integer("required", { mode: "boolean" }).notNull().default(false),
  minSel:    integer("min_sel").notNull().default(0),
  maxSel:    integer("max_sel").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const options = sqliteTable("options", {
  id:            text("id").primaryKey(),
  tenantId:      text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  optionGroupId: text("option_group_id").notNull().references(() => optionGroups.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  priceDelta:    real("price_delta").notNull().default(0),
  prefix:        text("prefix").notNull().default("+"), // "+" | "-" | ">>"
  active:        integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder:     integer("sort_order").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id:           text("id").primaryKey(),
  tenantId:     text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderCode:    text("order_code").notNull(),
  tableId:      text("table_id").notNull(),
  customerName: text("customer_name"),
  itemsJson:    text("items_json").notNull(), // raw JSON snapshot: [{productId, name, price, quantity}]
  totalAmount:  real("total_amount").notNull(),
  createdAt:    integer("created_at").notNull(),
}, (t) => ({
  codeUniq: uniqueIndex("orders_code_uniq").on(t.tenantId, t.orderCode),
}));

export const users = sqliteTable("users", {
  id:            text("id").primaryKey(),
  email:         text("email").notNull(),
  passwordHash:  text("password_hash").notNull(),
  isSuperAdmin:  integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
  active:        integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt:     integer("created_at").notNull(),
}, (t) => ({
  emailUniq: uniqueIndex("users_email_uniq").on(t.email),
}));

export const tenantUsers = sqliteTable("tenant_users", {
  id:        text("id").primaryKey(),
  tenantId:  text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:      text("role").notNull(), // "owner" | "operator"
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  tenantUserUniq: uniqueIndex("tenant_users_tenant_user_uniq").on(t.tenantId, t.userId),
}));

export const auditLog = sqliteTable("audit_log", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull().references(() => users.id),
  tenantId:     text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  action:       text("action").notNull(),
  metadataJson: text("metadata_json"),
  createdAt:    integer("created_at").notNull(),
});
