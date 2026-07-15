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
-- idx_orders_shift_id moved to EXTRA_COLUMNS (column added via ALTER TABLE)
CREATE INDEX IF NOT EXISTS idx_orders_created_at           ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id        ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id           ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_handler    ON processed_events(handler_id, trace_id);
-- idx_inventory_movements_* moved after table definition below

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

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item  ON inventory_movements(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(order_id);

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

CREATE TABLE IF NOT EXISTS shift_report_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  print_mode   TEXT NOT NULL DEFAULT 'image',
  canvas_width INTEGER NOT NULL DEFAULT 576,
  blocks       TEXT,
  logo_path    TEXT
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

CREATE TABLE IF NOT EXISTS terminal_categories (
  terminal_id TEXT NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (terminal_id, category_id)
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
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);
ALTER TABLE orders ADD COLUMN receipt_number INTEGER;
INSERT OR IGNORE INTO app_settings(key,value) VALUES('receipt_number_mode','shift');
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
INSERT OR IGNORE INTO app_settings(key,value) VALUES('cart_notes_enabled','true');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('cart_pax_enabled','true');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('cart_discount_enabled','true');
ALTER TABLE inventory_items ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN reset_on_shift_open INTEGER NOT NULL DEFAULT 0;
ALTER TABLE options ADD COLUMN prefix TEXT NOT NULL DEFAULT '+';
ALTER TABLE products ADD COLUMN vat_rate INTEGER NOT NULL DEFAULT 10;
ALTER TABLE orders ADD COLUMN fiscal_doc_number TEXT;
ALTER TABLE orders ADD COLUMN fiscal_doc_date TEXT;
ALTER TABLE orders ADD COLUMN fiscal_rt_serial TEXT;
ALTER TABLE shifts ADD COLUMN z_report_fiscal TEXT;
INSERT OR IGNORE INTO app_settings(key,value) VALUES('fiscal_enabled','false');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('fiscal_rt_type','epson');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('fiscal_rt_host','192.168.1.100');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('fiscal_rt_port','8008');
INSERT OR IGNORE INTO app_settings(key,value) VALUES('fiscal_rt_serial','');
INSERT OR IGNORE INTO modules(name, enabled, version, created_at, updated_at) VALUES('fiscal', 0, '0.1.0', unixepoch(), unixepoch());
ALTER TABLE terminals ADD COLUMN default_view_mode TEXT;
ALTER TABLE orders ADD COLUMN terminal_id TEXT REFERENCES terminals(id);
ALTER TABLE production_centers ADD COLUMN receipt_print_mode TEXT NOT NULL DEFAULT 'included';
ALTER TABLE payment_methods ADD COLUMN exclude_from_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN customer_name TEXT;
INSERT OR IGNORE INTO payment_methods(id, name, type, active, sort_order, icon) VALUES('cash', 'Contanti', 'cash', 1, 0, null);
INSERT OR IGNORE INTO payment_methods(id, name, type, active, sort_order, icon) VALUES('card', 'Carta', 'card', 1, 1, null);
INSERT OR IGNORE INTO payment_methods(id, name, type, active, sort_order, icon) VALUES('digital_wallet', 'Wallet digitale', 'digital_wallet', 1, 2, null);
INSERT OR IGNORE INTO payment_methods(id, name, type, active, sort_order, icon) VALUES('tab', 'Conto sospeso', 'tab', 1, 3, null);
ALTER TABLE products ADD COLUMN receipt_print_mode TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE receipt_templates ADD COLUMN show_item_category INTEGER NOT NULL DEFAULT 0;
ALTER TABLE production_centers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE production_centers ADD COLUMN icon TEXT;
CREATE TABLE IF NOT EXISTS order_center_numbers (
  order_id             INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  production_center_id INTEGER NOT NULL REFERENCES production_centers(id) ON DELETE CASCADE,
  center_number        INTEGER NOT NULL,
  PRIMARY KEY (order_id, production_center_id)
);
`;

// payments.method used to be a CHECK-constrained enum column (cash/card/digital_wallet/tab).
// SQLite can't drop a CHECK via ALTER TABLE, so widen it via table-rebuild if still present.
function dropPaymentsMethodCheck(sqlite: Database.Database): void {
  const row = sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'"
  ).get() as { sql?: string } | undefined;
  if (!row?.sql || !row.sql.includes("CHECK(method IN")) return;
  sqlite.exec(`
    ALTER TABLE payments RENAME TO payments_old_check;
    CREATE TABLE payments (
      id         TEXT PRIMARY KEY,
      order_id   TEXT NOT NULL REFERENCES orders(id),
      method     TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','completed','failed','refunded')),
      amount     REAL NOT NULL,
      currency   TEXT NOT NULL DEFAULT 'EUR',
      reference  TEXT,
      terminal_id TEXT REFERENCES terminals(id),
      created_at INTEGER NOT NULL,
      synced_at  INTEGER
    );
    INSERT INTO payments SELECT id, order_id, method, status, amount, currency, reference, created_at, synced_at, NULL FROM payments_old_check;
    DROP TABLE payments_old_check;
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
  `);
}

// Migrate all entity PKs from TEXT UUID to INTEGER AUTOINCREMENT.
// Idempotent: checks if id column is already INTEGER before running.
function migrateUuidToInt(sqlite: Database.Database): void {
  // Check schema only — data presence doesn't matter
  const usersSchema = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql?: string } | undefined;
  if (!usersSchema?.sql || usersSchema.sql.includes("INTEGER PRIMARY KEY")) return;

  sqlite.pragma("foreign_keys = OFF");
  // legacy_alter_table = ON prevents SQLite from auto-rewriting FK references when a table
  // is renamed. Without this, "ALTER TABLE users RENAME TO _usr_old" would update
  // "REFERENCES users(id)" → "REFERENCES _usr_old(id)" in dependent tables, corrupting them.
  sqlite.pragma("legacy_alter_table = ON");

  // Wrap entire migration in a transaction so an interrupted run leaves the DB unchanged.
  sqlite.exec("BEGIN");
  try {

  // Clean up any leftover _old tables from a previously interrupted migration
  const oldTables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '\\_%' ESCAPE '\\'").all() as { name: string }[]).map((r) => r.name);
  for (const t of oldTables) sqlite.exec(`DROP TABLE IF EXISTS "${t}"`);
  // Clean up any leftover temp junction tables
  for (const t of ["_junc_tc","_junc_tp","_junc_pcp","_junc_pcc","_cat_name_map","_pc_name_map","_pr_name_map","_term_name_map"]) {
    try { sqlite.exec(`DROP TABLE IF EXISTS temp."${t}"`); } catch { /* ignore */ }
  }

  // Rebuild order: leaf tables first, then tables they reference, roots last.
  // Each rebuild: rename old → create new with INTEGER PK → copy data → drop old → rename new.

  // 1. order_item_options (refs order_items)
  sqlite.exec(`
    ALTER TABLE order_item_options RENAME TO _oio_old;
    CREATE TABLE order_item_options (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id  INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      option_id      INTEGER NOT NULL,
      option_name    TEXT NOT NULL,
      price_delta    REAL NOT NULL DEFAULT 0
    );
    INSERT INTO order_item_options(order_item_id, option_id, option_name, price_delta)
      SELECT order_item_id, option_id, option_name, price_delta FROM _oio_old;
    DROP TABLE _oio_old;
  `);

  // 2. options (refs option_groups)
  sqlite.exec(`
    ALTER TABLE options RENAME TO _opts_old;
    CREATE TABLE options (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      option_group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      price_delta     REAL NOT NULL DEFAULT 0,
      prefix          TEXT NOT NULL DEFAULT '+',
      active          INTEGER NOT NULL DEFAULT 1,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO options(option_group_id, name, price_delta, prefix, active, sort_order)
      SELECT option_group_id, name, price_delta, COALESCE(prefix,'+'), active, sort_order FROM _opts_old;
    DROP TABLE _opts_old;
  `);

  // 3. product_grid_layouts (refs products)
  sqlite.exec(`
    ALTER TABLE product_grid_layouts RENAME TO _pgl_old;
    CREATE TABLE product_grid_layouts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      scope      TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      slot_x     INTEGER NOT NULL DEFAULT 0,
      slot_y     INTEGER NOT NULL DEFAULT 0,
      span_w     INTEGER NOT NULL DEFAULT 1,
      span_h     INTEGER NOT NULL DEFAULT 1,
      UNIQUE(scope, product_id)
    );
    INSERT INTO product_grid_layouts(scope, product_id, slot_x, slot_y, span_w, span_h)
      SELECT scope, product_id, slot_x, slot_y, span_w, span_h FROM _pgl_old;
    DROP TABLE _pgl_old;
  `);

  // 4. sessions (refs users)
  sqlite.exec(`
    ALTER TABLE sessions RENAME TO _sess_old;
    CREATE TABLE sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    INSERT INTO sessions(user_id, token, created_at, expires_at)
      SELECT user_id, token, created_at, expires_at FROM _sess_old;
    DROP TABLE _sess_old;
    CREATE INDEX IF NOT EXISTS idx_sessions_token     ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  // 5. kitchen_templates (refs production_centers)
  sqlite.exec(`
    ALTER TABLE kitchen_templates RENAME TO _kt_old;
    CREATE TABLE kitchen_templates (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL,
      production_center_id INTEGER REFERENCES production_centers(id) ON DELETE SET NULL,
      active               INTEGER NOT NULL DEFAULT 1,
      print_mode           TEXT NOT NULL DEFAULT 'text',
      canvas_width         INTEGER NOT NULL DEFAULT 576,
      blocks               TEXT,
      logo_path            TEXT
    );
    INSERT INTO kitchen_templates(name, production_center_id, active, print_mode, canvas_width, blocks, logo_path)
      SELECT name, production_center_id, active, print_mode, canvas_width, blocks, logo_path FROM _kt_old;
    DROP TABLE _kt_old;
  `);

  // 6. shift_report_templates
  sqlite.exec(`
    ALTER TABLE shift_report_templates RENAME TO _srt_old;
    CREATE TABLE shift_report_templates (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      active       INTEGER NOT NULL DEFAULT 1,
      print_mode   TEXT NOT NULL DEFAULT 'image',
      canvas_width INTEGER NOT NULL DEFAULT 576,
      blocks       TEXT,
      logo_path    TEXT
    );
    INSERT INTO shift_report_templates(name, active, print_mode, canvas_width, blocks, logo_path)
      SELECT name, active, print_mode, canvas_width, blocks, logo_path FROM _srt_old;
    DROP TABLE _srt_old;
  `);

  // 7. receipt_templates
  sqlite.exec(`
    ALTER TABLE receipt_templates RENAME TO _rt_old;
    CREATE TABLE receipt_templates (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL,
      header_text          TEXT,
      footer_text          TEXT,
      show_logo            INTEGER NOT NULL DEFAULT 0,
      show_order_number    INTEGER NOT NULL DEFAULT 1,
      show_timestamp       INTEGER NOT NULL DEFAULT 1,
      show_payment_method  INTEGER NOT NULL DEFAULT 1,
      show_item_category   INTEGER NOT NULL DEFAULT 0,
      active               INTEGER NOT NULL DEFAULT 1,
      print_mode           TEXT NOT NULL DEFAULT 'text',
      canvas_width         INTEGER NOT NULL DEFAULT 576,
      logo_path            TEXT,
      blocks               TEXT,
      print_method         TEXT NOT NULL DEFAULT 'single',
      role                 TEXT NOT NULL DEFAULT 'master'
    );
    INSERT INTO receipt_templates(name, header_text, footer_text, show_logo, show_order_number, show_timestamp, show_payment_method, show_item_category, active, print_mode, canvas_width, logo_path, blocks, print_method, role)
      SELECT name, header_text, footer_text, show_logo, show_order_number, show_timestamp, show_payment_method, COALESCE(show_item_category,0), active, COALESCE(print_mode,'text'), COALESCE(canvas_width,576), logo_path, blocks, COALESCE(print_method,'single'), COALESCE(role,'master') FROM _rt_old;
    DROP TABLE _rt_old;
  `);

  // 8. inventory_movements (refs inventory_items, orders)
  sqlite.exec(`
    ALTER TABLE inventory_movements RENAME TO _im_old;
    CREATE TABLE inventory_movements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id    INTEGER NOT NULL REFERENCES inventory_items(id),
      type       TEXT NOT NULL CHECK(type IN ('sale','restock','manual','waste')),
      quantity   REAL NOT NULL,
      reason     TEXT,
      order_id   INTEGER REFERENCES orders(id),
      created_at INTEGER NOT NULL
    );
    INSERT INTO inventory_movements(item_id, type, quantity, reason, order_id, created_at)
      SELECT item_id, type, quantity, reason, order_id, created_at FROM _im_old;
    DROP TABLE _im_old;
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item  ON inventory_movements(item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(order_id);
  `);

  // 9. order_items (refs orders, products)
  sqlite.exec(`
    ALTER TABLE order_items RENAME TO _oi_old;
    CREATE TABLE order_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL,
      name       TEXT NOT NULL,
      quantity   INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      notes      TEXT
    );
    INSERT INTO order_items(order_id, product_id, name, quantity, unit_price, notes)
      SELECT order_id, product_id, name, quantity, unit_price, notes FROM _oi_old;
    DROP TABLE _oi_old;
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  // 10. payments (refs orders, terminals)
  sqlite.exec(`
    ALTER TABLE payments RENAME TO _pay_old;
    CREATE TABLE payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      method      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','completed','failed','refunded')),
      amount      REAL NOT NULL,
      currency    TEXT NOT NULL DEFAULT 'EUR',
      reference   TEXT,
      terminal_id INTEGER REFERENCES terminals(id),
      created_at  INTEGER NOT NULL,
      synced_at   INTEGER
    );
    INSERT INTO payments(order_id, method, status, amount, currency, reference, terminal_id, created_at, synced_at)
      SELECT order_id, method, status, amount, currency, reference, terminal_id, created_at, synced_at FROM _pay_old;
    DROP TABLE _pay_old;
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
  `);

  // 11. option_groups (refs products)
  sqlite.exec(`
    ALTER TABLE option_groups RENAME TO _og_old;
    CREATE TABLE option_groups (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('single','multi','removal')),
      required    INTEGER NOT NULL DEFAULT 0,
      min_sel     INTEGER NOT NULL DEFAULT 0,
      max_sel     INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO option_groups(product_id, name, type, required, min_sel, max_sel, sort_order)
      SELECT product_id, name, type, required, min_sel, max_sel, sort_order FROM _og_old;
    DROP TABLE _og_old;
  `);

  // 12. product_ingredients (refs products, inventory_items)
  sqlite.exec(`
    ALTER TABLE product_ingredients RENAME TO _pi_old;
    CREATE TABLE product_ingredients (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      quantity          REAL NOT NULL DEFAULT 1
    );
    INSERT INTO product_ingredients(product_id, inventory_item_id, quantity)
      SELECT product_id, inventory_item_id, quantity FROM _pi_old;
    DROP TABLE _pi_old;
  `);

  // 13. inventory_items (refs products, production_centers)
  sqlite.exec(`
    ALTER TABLE inventory_items RENAME TO _ii_old;
    CREATE TABLE inventory_items (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL,
      sku                  TEXT,
      unit                 TEXT NOT NULL DEFAULT 'pz',
      current_stock        REAL NOT NULL DEFAULT 0,
      min_stock            REAL NOT NULL DEFAULT 0,
      production_center_id INTEGER,
      product_id           INTEGER REFERENCES products(id) ON DELETE SET NULL,
      reset_on_shift_open  INTEGER NOT NULL DEFAULT 0,
      created_at           INTEGER NOT NULL,
      updated_at           INTEGER NOT NULL
    );
    INSERT INTO inventory_items(name, sku, unit, current_stock, min_stock, production_center_id, product_id, reset_on_shift_open, created_at, updated_at)
      SELECT name, sku, unit, current_stock, min_stock, production_center_id, product_id, COALESCE(reset_on_shift_open,0), created_at, updated_at FROM _ii_old;
    DROP TABLE _ii_old;
  `);

  // 14. junction tables: save old data, drop, will recreate after parent tables are rebuilt
  sqlite.exec(`
    CREATE TEMP TABLE _junc_tc AS SELECT * FROM terminal_categories;
    CREATE TEMP TABLE _junc_tp AS SELECT * FROM terminal_printers;
    CREATE TEMP TABLE _junc_pcp AS SELECT * FROM production_center_printers;
    CREATE TEMP TABLE _junc_pcc AS SELECT * FROM production_center_categories;
    DROP TABLE terminal_categories;
    DROP TABLE terminal_printers;
    DROP TABLE production_center_printers;
    DROP TABLE production_center_categories;
  `);

  // 15. orders (refs shifts, terminals)
  sqlite.exec(`
    ALTER TABLE orders RENAME TO _ord_old;
    CREATE TABLE orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id        TEXT,
      customer_name   TEXT,
      event_id        TEXT,
      shift_id        INTEGER,
      terminal_id     INTEGER REFERENCES terminals(id),
      status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','confirmed','preparing','ready','completed','cancelled')),
      total_amount    REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_type   TEXT,
      notes           TEXT,
      pax             INTEGER,
      receipt_number  INTEGER,
      fiscal_doc_number TEXT,
      fiscal_doc_date TEXT,
      fiscal_rt_serial TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      synced_at       INTEGER
    );
    INSERT INTO orders(table_id, customer_name, event_id, shift_id, terminal_id, status, total_amount, discount_amount, discount_type, notes, pax, receipt_number, fiscal_doc_number, fiscal_doc_date, fiscal_rt_serial, created_at, updated_at, synced_at)
      SELECT table_id, customer_name, event_id, shift_id, terminal_id, status, total_amount, COALESCE(discount_amount,0), discount_type, notes, pax, receipt_number, fiscal_doc_number, fiscal_doc_date, fiscal_rt_serial, created_at, updated_at, synced_at FROM _ord_old;
    DROP TABLE _ord_old;
    CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_shift_id   ON orders(shift_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_shift_id_idx   ON orders(shift_id);
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_status_idx     ON orders(status);
  `);

  // 16. shifts (refs users)
  sqlite.exec(`
    ALTER TABLE shifts RENAME TO _sh_old;
    CREATE TABLE shifts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      opened_at    INTEGER NOT NULL,
      closed_at    INTEGER,
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      total_sales  REAL NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      notes        TEXT,
      z_report_fiscal TEXT
    );
    INSERT INTO shifts(user_id, opened_at, closed_at, opening_cash, closing_cash, total_sales, total_orders, notes, z_report_fiscal)
      SELECT user_id, opened_at, closed_at, opening_cash, closing_cash, total_sales, total_orders, notes, z_report_fiscal FROM _sh_old;
    DROP TABLE _sh_old;
  `);

  // 17. printers
  sqlite.exec(`ALTER TABLE printers RENAME TO _pr_old`);
  sqlite.exec(`
    CREATE TABLE printers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      type             TEXT NOT NULL DEFAULT 'escpos',
      connection_type  TEXT NOT NULL DEFAULT 'network',
      host             TEXT,
      port             INTEGER,
      active           INTEGER NOT NULL DEFAULT 1,
      receipt_enabled  INTEGER NOT NULL DEFAULT 0,
      kitchen_enabled  INTEGER NOT NULL DEFAULT 0,
      print_mode       TEXT NOT NULL DEFAULT 'text'
    )
  `);
  sqlite.exec(`INSERT INTO printers(name, type, connection_type, host, port, active, receipt_enabled, kitchen_enabled, print_mode)
    SELECT name, COALESCE(type,'escpos'), COALESCE(connection_type,'network'), host, port, active, COALESCE(receipt_enabled,0), COALESCE(kitchen_enabled,0), COALESCE(print_mode,'text') FROM _pr_old`);
  sqlite.exec(`CREATE TEMP TABLE _pr_name_map AS
    SELECT old.id AS old_uuid, new.id AS new_int
    FROM _pr_old old JOIN printers new ON new.name = old.name`);
  sqlite.exec(`DROP TABLE _pr_old`);
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS printers_host_port_uniq ON printers(host, port)`);

  // 18. terminals
  sqlite.exec(`ALTER TABLE terminals RENAME TO _term_old`);
  sqlite.exec(`
    CREATE TABLE terminals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      active           INTEGER NOT NULL DEFAULT 1,
      created_at       INTEGER NOT NULL,
      last_seen_at     INTEGER,
      default_view_mode TEXT
    )
  `);
  sqlite.exec(`INSERT INTO terminals(name, active, created_at, last_seen_at, default_view_mode)
    SELECT name, active, created_at, last_seen_at, default_view_mode FROM _term_old`);
  sqlite.exec(`CREATE TEMP TABLE _term_name_map AS
    SELECT old.id AS old_uuid, new.id AS new_int
    FROM _term_old old JOIN terminals new ON new.name = old.name`);
  sqlite.exec(`DROP TABLE _term_old`);

  // 19. categories
  sqlite.exec(`ALTER TABLE categories RENAME TO _cat_old`);
  sqlite.exec(`
    CREATE TABLE categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      color      TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1
    )
  `);
  sqlite.exec(`INSERT INTO categories(name, color, sort_order, active)
    SELECT name, color, COALESCE(sort_order,0), COALESCE(active,1) FROM _cat_old`);
  sqlite.exec(`CREATE TEMP TABLE _cat_name_map AS
    SELECT old.id AS old_uuid, new.id AS new_int
    FROM _cat_old old JOIN categories new ON new.name = old.name`);
  sqlite.exec(`DROP TABLE _cat_old`);

  // 20. production_centers
  sqlite.exec(`ALTER TABLE production_centers RENAME TO _pc_old`);
  sqlite.exec(`
    CREATE TABLE production_centers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      color            TEXT,
      icon             TEXT,
      receipt_print_mode TEXT NOT NULL DEFAULT 'included',
      sort_order       INTEGER NOT NULL DEFAULT 0
    )
  `);
  sqlite.exec(`INSERT INTO production_centers(name, color, icon, receipt_print_mode, sort_order)
    SELECT name, color, icon, COALESCE(receipt_print_mode,'included'), COALESCE(sort_order,0) FROM _pc_old`);
  sqlite.exec(`CREATE TEMP TABLE _pc_name_map AS
    SELECT old.id AS old_uuid, new.id AS new_int
    FROM _pc_old old JOIN production_centers new ON new.name = old.name`);
  sqlite.exec(`DROP TABLE _pc_old`);

  // 20b. Rebuild junction tables now that all parent tables have integer IDs
  sqlite.exec(`CREATE TABLE terminal_categories (
    terminal_id INTEGER NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (terminal_id, category_id)
  )`);
  sqlite.exec(`INSERT INTO terminal_categories(terminal_id, category_id, sort_order)
    SELECT tm.new_int, cm.new_int, COALESCE(j.sort_order, 0)
    FROM _junc_tc j
    JOIN _term_name_map tm ON tm.old_uuid = j.terminal_id
    JOIN _cat_name_map  cm ON cm.old_uuid = j.category_id`);

  sqlite.exec(`CREATE TABLE terminal_printers (
    terminal_id INTEGER NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
    printer_id  INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    PRIMARY KEY (terminal_id, printer_id)
  )`);
  sqlite.exec(`INSERT INTO terminal_printers(terminal_id, printer_id)
    SELECT tm.new_int, pm.new_int
    FROM _junc_tp j
    JOIN _term_name_map tm ON tm.old_uuid = j.terminal_id
    JOIN _pr_name_map   pm ON pm.old_uuid = j.printer_id`);

  sqlite.exec(`CREATE TABLE production_center_printers (
    production_center_id INTEGER NOT NULL REFERENCES production_centers(id) ON DELETE CASCADE,
    printer_id           INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    PRIMARY KEY (production_center_id, printer_id)
  )`);
  sqlite.exec(`INSERT INTO production_center_printers(production_center_id, printer_id)
    SELECT pcm.new_int, pm.new_int
    FROM _junc_pcp j
    JOIN _pc_name_map  pcm ON pcm.old_uuid = j.production_center_id
    JOIN _pr_name_map  pm  ON pm.old_uuid  = j.printer_id`);

  sqlite.exec(`CREATE TABLE production_center_categories (
    production_center_id INTEGER NOT NULL REFERENCES production_centers(id) ON DELETE CASCADE,
    category_id          INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (production_center_id, category_id)
  )`);
  sqlite.exec(`INSERT INTO production_center_categories(production_center_id, category_id)
    SELECT pcm.new_int, cm.new_int
    FROM _junc_pcc j
    JOIN _pc_name_map  pcm ON pcm.old_uuid = j.production_center_id
    JOIN _cat_name_map cm  ON cm.old_uuid  = j.category_id`);

  sqlite.exec(`DROP TABLE _junc_tc`);
  sqlite.exec(`DROP TABLE _junc_tp`);
  sqlite.exec(`DROP TABLE _junc_pcp`);
  sqlite.exec(`DROP TABLE _junc_pcc`);
  sqlite.exec(`DROP TABLE _term_name_map`);
  sqlite.exec(`DROP TABLE _pr_name_map`);

  // 21. products (refs categories, production_centers)
  // Resolve FK via name mapping tables built in steps 19-20
  sqlite.exec(`ALTER TABLE products RENAME TO _prod_old`);
  sqlite.exec(`CREATE TABLE products (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL,
    price                REAL NOT NULL,
    category_id          INTEGER REFERENCES categories(id),
    production_center_id INTEGER REFERENCES production_centers(id),
    active               INTEGER NOT NULL DEFAULT 1,
    color                TEXT,
    description          TEXT,
    image_data           TEXT,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    vat_rate             INTEGER NOT NULL DEFAULT 10,
    receipt_print_mode   TEXT NOT NULL DEFAULT 'inherit',
    created_at           INTEGER,
    updated_at           INTEGER
  )`);
  sqlite.exec(`INSERT INTO products(name, price, category_id, production_center_id, active, color, description, image_data, sort_order, vat_rate, receipt_print_mode, created_at, updated_at)
    SELECT
      p.name, p.price,
      c.new_int,
      pc.new_int,
      p.active, p.color, p.description, p.image_data,
      COALESCE(p.sort_order,0), COALESCE(p.vat_rate,10),
      COALESCE(p.receipt_print_mode,'inherit'),
      p.created_at, p.updated_at
    FROM _prod_old p
    LEFT JOIN _cat_name_map c  ON c.old_uuid = p.category_id
    LEFT JOIN _pc_name_map  pc ON pc.old_uuid = p.production_center_id`);
  sqlite.exec(`DROP TABLE _prod_old`);
  sqlite.exec(`DROP TABLE _cat_name_map`);
  sqlite.exec(`DROP TABLE _pc_name_map`);

  // 22. users
  sqlite.exec(`ALTER TABLE users RENAME TO _usr_old`);
  sqlite.exec(`
    CREATE TABLE users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      username   TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL CHECK(role IN ('admin','cashier','kitchen','waiter','viewer')),
      pin        TEXT,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `);
  sqlite.exec(`INSERT INTO users(name, username, role, pin, active, created_at)
    SELECT name, username, role, pin, active, created_at FROM _usr_old`);
  sqlite.exec(`DROP TABLE _usr_old`);

  sqlite.exec("COMMIT");
  } catch (err) {
    try { sqlite.exec("ROLLBACK"); } catch { /* ignore if no active txn */ }
    sqlite.pragma("legacy_alter_table = OFF");
    sqlite.pragma("foreign_keys = ON");
    throw err;
  }

  sqlite.pragma("legacy_alter_table = OFF");
  sqlite.pragma("foreign_keys = ON");
}

export function runMigrations(dbPath: string): void {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  dropPaymentsMethodCheck(sqlite);
  // Add columns idempotently — SQLite throws if column already exists
  for (const stmt of EXTRA_COLUMNS.trim().split("\n")) {
    try { sqlite.exec(stmt); } catch { /* column already exists */ }
  }
  migrateUuidToInt(sqlite);
  sqlite.close();
}
