import Database from "better-sqlite3";

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  username   TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK(role IN ('admin','cashier','kitchen','waiter','viewer')),
  pin        TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  table_id     TEXT,
  event_id     TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','confirmed','preparing','ready','completed','cancelled')),
  total_amount REAL NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  synced_at    INTEGER
);

CREATE TABLE IF NOT EXISTS order_items (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  quantity   INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id),
  method     TEXT NOT NULL CHECK(method IN ('cash','card','digital_wallet','tab')),
  status     TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending','completed','failed','refunded')),
  amount     REAL NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'EUR',
  reference  TEXT,
  created_at INTEGER NOT NULL,
  synced_at  INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_events (
  handler_id   TEXT NOT NULL,
  trace_id     TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  PRIMARY KEY (handler_id, trace_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token              ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id            ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at         ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_status               ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id             ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at           ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id        ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id           ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_handler    ON processed_events(handler_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item    ON inventory_movements(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order   ON inventory_movements(order_id);

CREATE TABLE IF NOT EXISTS categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  category_id TEXT REFERENCES categories(id),
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS production_centers (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_center_categories (
  production_center_id TEXT NOT NULL REFERENCES production_centers(id) ON DELETE CASCADE,
  category_id          TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (production_center_id, category_id)
);

CREATE TABLE IF NOT EXISTS option_groups (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('single','multi','removal')),
  required    INTEGER NOT NULL DEFAULT 0,
  min_sel     INTEGER NOT NULL DEFAULT 0,
  max_sel     INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
  id              TEXT PRIMARY KEY,
  option_group_id TEXT NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_delta     REAL NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon       TEXT
);

CREATE TABLE IF NOT EXISTS printers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'escpos',
  connection_type  TEXT NOT NULL DEFAULT 'network',
  host             TEXT,
  port             INTEGER,
  active           INTEGER NOT NULL DEFAULT 1,
  receipt_enabled  INTEGER NOT NULL DEFAULT 0,
  kitchen_enabled  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS receipt_templates (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  header_text          TEXT,
  footer_text          TEXT,
  show_logo            INTEGER NOT NULL DEFAULT 0,
  show_order_number    INTEGER NOT NULL DEFAULT 1,
  show_timestamp       INTEGER NOT NULL DEFAULT 1,
  show_payment_method  INTEGER NOT NULL DEFAULT 1,
  active               INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shifts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  opened_at    INTEGER NOT NULL,
  closed_at    INTEGER,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash REAL,
  total_sales  REAL NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
  name       TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 1,
  version    TEXT NOT NULL DEFAULT '0.1.0',
  config     TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  sku                  TEXT,
  unit                 TEXT NOT NULL DEFAULT 'pz',
  current_stock        REAL NOT NULL DEFAULT 0,
  min_stock            REAL NOT NULL DEFAULT 0,
  production_center_id TEXT REFERENCES production_centers(id),
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL REFERENCES inventory_items(id),
  type       TEXT NOT NULL CHECK(type IN ('sale','restock','manual','waste')),
  quantity   REAL NOT NULL,
  reason     TEXT,
  order_id   TEXT REFERENCES orders(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity          REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS receipt_counters (
  scope      TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_item_options (
  id             TEXT PRIMARY KEY,
  order_item_id  TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id      TEXT NOT NULL,
  option_name    TEXT NOT NULL,
  price_delta    REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS production_center_printers (
  production_center_id TEXT NOT NULL REFERENCES production_centers(id) ON DELETE CASCADE,
  printer_id           TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  PRIMARY KEY (production_center_id, printer_id)
);

CREATE TABLE IF NOT EXISTS kitchen_templates (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  production_center_id TEXT REFERENCES production_centers(id) ON DELETE SET NULL,
  active               INTEGER NOT NULL DEFAULT 1,
  print_mode           TEXT NOT NULL DEFAULT 'text',
  canvas_width         INTEGER NOT NULL DEFAULT 576,
  blocks               TEXT,
  logo_path            TEXT
);

CREATE TABLE IF NOT EXISTS product_grid_layouts (
  id         TEXT PRIMARY KEY,
  scope      TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slot_x     INTEGER NOT NULL DEFAULT 0,
  slot_y     INTEGER NOT NULL DEFAULT 0,
  span_w     INTEGER NOT NULL DEFAULT 1,
  span_h     INTEGER NOT NULL DEFAULT 1,
  UNIQUE(scope, product_id)
);

CREATE TABLE IF NOT EXISTS terminals (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS terminal_printers (
  terminal_id TEXT NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  printer_id  TEXT NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  PRIMARY KEY (terminal_id, printer_id)
);
`;

const EXTRA_COLUMNS = `
ALTER TABLE categories ADD COLUMN color TEXT;
ALTER TABLE products ADD COLUMN color TEXT;
ALTER TABLE production_centers ADD COLUMN color TEXT;
ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN image_data TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN created_at INTEGER;
ALTER TABLE products ADD COLUMN updated_at INTEGER;
ALTER TABLE orders ADD COLUMN shift_id TEXT REFERENCES shifts(id);
ALTER TABLE orders ADD COLUMN receipt_number INTEGER;
INSERT OR IGNORE INTO app_settings(key,value) VALUES('receipt_number_mode','default');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('receipt_number_prefix','');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('receipt_number_padding','0');
INSERT OR IGNORE INTO receipt_counters(scope, last_value) VALUES('global', 0);
INSERT OR IGNORE INTO app_settings(key, value) VALUES('express_mode', 'false');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_name', '');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_address', '');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_city', '');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_vat', '');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_phone', '');
INSERT OR IGNORE INTO app_settings(key, value) VALUES('restaurant_website', '');
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('pos', 1, '0.2.0', unixepoch(), unixepoch());
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('kitchen', 1, '0.2.0', unixepoch(), unixepoch());
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('payments', 1, '0.2.0', unixepoch(), unixepoch());
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('inventory', 0, '0.2.0', unixepoch(), unixepoch());
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('tables', 0, '0.2.0', unixepoch(), unixepoch());
ALTER TABLE printers ADD COLUMN print_mode TEXT NOT NULL DEFAULT 'text';
ALTER TABLE receipt_templates ADD COLUMN print_mode TEXT NOT NULL DEFAULT 'text';
ALTER TABLE receipt_templates ADD COLUMN canvas_width INTEGER NOT NULL DEFAULT 576;
ALTER TABLE receipt_templates ADD COLUMN logo_path TEXT;
ALTER TABLE receipt_templates ADD COLUMN blocks TEXT;
ALTER TABLE products ADD COLUMN production_center_id TEXT REFERENCES production_centers(id);
INSERT OR IGNORE INTO app_settings(key,value) VALUES('grid_view_mode','category');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('grid_show_price','true');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('grid_show_description','true');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('grid_sort_by','custom');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('grid_base_cols','5');
ALTER TABLE receipt_templates ADD COLUMN print_method TEXT NOT NULL DEFAULT 'single';
ALTER TABLE receipt_templates ADD COLUMN role TEXT NOT NULL DEFAULT 'master';
ALTER TABLE payments ADD COLUMN terminal_id TEXT REFERENCES terminals(id);
INSERT OR IGNORE INTO app_settings(key,value) VALUES('multi_terminal_enabled','false');
CREATE UNIQUE INDEX IF NOT EXISTS printers_host_port_uniq ON printers(host, port) WHERE host IS NOT NULL AND port IS NOT NULL;
ALTER TABLE orders ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_type TEXT;
ALTER TABLE orders ADD COLUMN pax INTEGER;
`;

export function runMigrations(dbPath: string): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  // Add columns idempotently — SQLite throws if column already exists
  for (const stmt of EXTRA_COLUMNS.trim().split("\n")) {
    try { sqlite.exec(stmt); } catch { /* column already exists */ }
  }
  sqlite.close();
}
