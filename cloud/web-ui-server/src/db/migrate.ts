import Database from "better-sqlite3";

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  api_key               TEXT NOT NULL,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            INTEGER NOT NULL,
  require_table_id      INTEGER NOT NULL DEFAULT 1,
  require_customer_name INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           REAL NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  available_dates TEXT
);

CREATE TABLE IF NOT EXISTS option_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  required   INTEGER NOT NULL DEFAULT 0,
  min_sel    INTEGER NOT NULL DEFAULT 0,
  max_sel    INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  option_group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_delta     REAL NOT NULL DEFAULT 0,
  prefix          TEXT NOT NULL DEFAULT '+',
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_code     TEXT NOT NULL,
  table_id       TEXT NOT NULL,
  customer_name  TEXT,
  items_json     TEXT NOT NULL,
  total_amount   REAL NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  tenant_id     TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  metadata_json TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant   ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_option_groups_product ON option_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_options_group         ON options(option_group_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant      ON orders(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_code_uniq ON orders(tenant_id, order_code);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_tenant_user_uniq ON tenant_users(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user   ON audit_log(user_id, created_at);
`;

function addColumnIfMissing(sqlite: Database.Database, table: string, column: string, ddl: string): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// categories/products/option_groups/options originally had TEXT (UUID) primary keys; they were
// switched to INTEGER AUTOINCREMENT to match the till's catalogue id format (see menu-sync.ts).
// No production tenant had real catalogue data yet, so on an old-schema DB we just drop and let the
// DDL below recreate them with the new column types — children first to respect foreign keys.
function dropLegacyCatalogTablesIfNeeded(sqlite: Database.Database): void {
  const tableExists = sqlite.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categories'`,
  ).get();
  if (!tableExists) return;

  const columns = sqlite.prepare(`PRAGMA table_info(categories)`).all() as { name: string; type: string }[];
  const idColumn = columns.find((c) => c.name === "id");
  if (idColumn?.type.toUpperCase() === "TEXT") {
    sqlite.exec(`
      DROP TABLE IF EXISTS options;
      DROP TABLE IF EXISTS option_groups;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS categories;
    `);
  }
}

export function runMigrations(dbPath: string): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  dropLegacyCatalogTablesIfNeeded(sqlite);
  sqlite.exec(DDL);

  // tenants.logo_path/color_brand/color_accent were added after the initial DDL above;
  // CREATE TABLE IF NOT EXISTS does not retrofit columns onto an already-existing table.
  addColumnIfMissing(sqlite, "tenants", "logo_path", "logo_path TEXT");
  addColumnIfMissing(sqlite, "tenants", "color_brand", "color_brand TEXT");
  addColumnIfMissing(sqlite, "tenants", "color_accent", "color_accent TEXT");
  addColumnIfMissing(sqlite, "tenants", "require_table_id", "require_table_id INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(sqlite, "tenants", "require_customer_name", "require_customer_name INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(sqlite, "categories", "emoji", "emoji TEXT");
  addColumnIfMissing(sqlite, "products", "available_dates", "available_dates TEXT");

  sqlite.close();
}
