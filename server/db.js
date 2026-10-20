const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'super_admin',
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, notes TEXT, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT, image_url TEXT, display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, code TEXT UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value REAL NOT NULL CHECK (discount_value > 0),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','category','product')),
  target_id TEXT, badge_text TEXT, banner_text TEXT,
  start_date TEXT, end_date TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, brand TEXT, model TEXT,
  slug TEXT NOT NULL UNIQUE, category TEXT, description TEXT,
  selling_price REAL CHECK (selling_price IS NULL OR selling_price >= 0),
original_price REAL CHECK (original_price IS NULL OR original_price >= 0),
offer_id INTEGER REFERENCES offers(id) ON DELETE SET NULL,
specs TEXT,
stock_location TEXT,
  is_new_arrival INTEGER NOT NULL DEFAULT 0, is_featured INTEGER NOT NULL DEFAULT 0,
  display_priority INTEGER NOT NULL DEFAULT 0,
  new_arrival_start TEXT, new_arrival_end TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_active INTEGER NOT NULL DEFAULT 1,
  date_added TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE, colour TEXT NOT NULL,
  price_override REAL CHECK (price_override IS NULL OR price_override >= 0),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  min_stock INTEGER NOT NULL DEFAULT 2 CHECK (min_stock >= 0),
  avg_cost REAL CHECK (avg_cost IS NULL OR avg_cost >= 0),
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
  UNIQUE (product_id, colour));

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL,
  original_path TEXT NOT NULL, web_path TEXT NOT NULL, alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY, supplier_id INTEGER REFERENCES suppliers(id), received_on TEXT NOT NULL,
  reference TEXT, notes TEXT, total_cost REAL, paid_amount REAL NOT NULL DEFAULT 0,
  created_by INTEGER, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY, occurred_at TEXT NOT NULL, occurred_on TEXT NOT NULL,
  product_id INTEGER NOT NULL, variant_id INTEGER NOT NULL REFERENCES variants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN
    ('purchase_received','sale','customer_return','customer_return_damaged','supplier_return','damage_loss','manual_correction')),
  quantity_change INTEGER NOT NULL, previous_qty INTEGER NOT NULL, new_qty INTEGER NOT NULL,
  non_sellable_qty INTEGER NOT NULL DEFAULT 0, unit_cost REAL, reason TEXT,
  order_id INTEGER, purchase_id INTEGER, user_id INTEGER);
CREATE INDEX IF NOT EXISTS idx_mov_on ON stock_movements(occurred_on);
CREATE INDEX IF NOT EXISTS idx_mov_variant ON stock_movements(variant_id);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY, ref TEXT NOT NULL UNIQUE,
  product_id INTEGER REFERENCES products(id), variant_id INTEGER REFERENCES variants(id),
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked','received','converted','closed')),
  source TEXT, customer_name TEXT, customer_contact TEXT, notes TEXT,
  created_at TEXT NOT NULL, created_on TEXT NOT NULL, confirmed_at TEXT, order_id INTEGER);
CREATE INDEX IF NOT EXISTS idx_enq_on ON enquiries(created_on);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, order_no TEXT NOT NULL UNIQUE, order_date TEXT NOT NULL,
  customer_name TEXT, customer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('enquiry','pending','confirmed','processing','ready','completed','cancelled','partially_returned','returned')),
  notes TEXT, enquiry_id INTEGER REFERENCES enquiries(id), cancel_reason TEXT,
  completed_on TEXT, created_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, variant_id INTEGER NOT NULL REFERENCES variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  line_discount REAL NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  stock_state TEXT NOT NULL DEFAULT 'none' CHECK (stock_state IN ('none','reserved','sold','released')),
  unit_cost_at_sale REAL, sold_on TEXT, returned_qty INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_items_sold ON order_items(sold_on);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('payment','refund')), amount REAL NOT NULL CHECK (amount > 0),
  paid_on TEXT NOT NULL, method TEXT, note TEXT, user_id INTEGER, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY, order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  condition TEXT NOT NULL CHECK (condition IN ('sellable','damaged')),
  returned_on TEXT NOT NULL, refund_value REAL NOT NULL, reason TEXT, user_id INTEGER, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, expense_on TEXT NOT NULL, category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0), description TEXT, payment_method TEXT,
  supplier_id INTEGER REFERENCES suppliers(id), created_by INTEGER, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_exp_on ON expenses(expense_on);

CREATE TABLE IF NOT EXISTS savings_entries (
  id INTEGER PRIMARY KEY, entry_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('deposit','withdrawal')),
  amount REAL NOT NULL CHECK (amount > 0), note TEXT, created_at TEXT NOT NULL);

 
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at
  ON audit_logs(at);
 

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL
);
`;

function migrateDb(db) {
  // Apply migrations safely for existing databases
  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('is_active')) {
    try { db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}
  }

  const prodCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
if (!prodCols.includes('offer_id')) {
  db.exec(`
    ALTER TABLE products
    ADD COLUMN offer_id INTEGER REFERENCES offers(id) ON DELETE SET NULL
  `);
}
  if (!prodCols.includes('display_priority')) {
    try { db.exec("ALTER TABLE products ADD COLUMN display_priority INTEGER NOT NULL DEFAULT 0"); } catch {}
  }
  if (!prodCols.includes('new_arrival_start')) {
    try { db.exec("ALTER TABLE products ADD COLUMN new_arrival_start TEXT"); } catch {}
  }
  if (!prodCols.includes('new_arrival_end')) {
    try { db.exec("ALTER TABLE products ADD COLUMN new_arrival_end TEXT"); } catch {}
  }

  // Seed default categories if none exist
  const catCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get().count;
  if (catCount === 0) {
    const insertCat = db.prepare("INSERT INTO categories (slug, name, description, display_order, created_at) VALUES (?, ?, ?, ?, ?)");
    const now = new Date().toISOString();
    insertCat.run('everyday-classics', 'Everyday Classics', 'Timeless dials and versatile designs crafted for effortless daily wear', 1, now);
    insertCat.run('trending', 'Trending & Modern', 'Contemporary silhouettes and bold aesthetics making waves right now', 2, now);
    insertCat.run('mens', "Men's Collection", 'Sophisticated chronographs, robust bracelets, and masculine accents', 3, now);
    insertCat.run('womens', "Women's Collection", 'Delicate dials, elegant mesh bracelets, and graceful finishes', 4, now);
  }
}

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateDb(db);
  return db;
}

module.exports = { openDb, SCHEMA };
