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

CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id   ON payments(order_id);

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
