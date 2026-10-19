-- TIMELESS TRENDS - PostgreSQL Schema Migration
-- Migration: 001_initial_schema.sql

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'owner', 'inventory_manager', 'marketing_manager')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sessions (Cookie session tokens)
CREATE TABLE IF NOT EXISTS public.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- 3. Settings (Key-Value)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 4. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order);

-- 6. Offers & Discounts
CREATE TABLE IF NOT EXISTS public.offers (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  code TEXT UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'category', 'product')),
  target_id TEXT,
  badge_text TEXT,
  banner_text TEXT,
  start_date DATE,
  end_date DATE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Products
CREATE TABLE IF NOT EXISTS public.products (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  selling_price NUMERIC CHECK (selling_price IS NULL OR selling_price >= 0),
  original_price NUMERIC CHECK (original_price IS NULL OR original_price >= 0),
  specs JSONB DEFAULT '[]'::jsonb,
  stock_location TEXT,
  is_new_arrival INTEGER NOT NULL DEFAULT 0 CHECK (is_new_arrival IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  display_priority INTEGER NOT NULL DEFAULT 0,
  new_arrival_start TIMESTAMPTZ,
  new_arrival_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status_active ON public.products(status, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_display_priority ON public.products(display_priority DESC, id DESC);

-- 8. Variants
CREATE TABLE IF NOT EXISTS public.variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  colour TEXT NOT NULL,
  price_override NUMERIC CHECK (price_override IS NULL OR price_override >= 0),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  min_stock INTEGER NOT NULL DEFAULT 2 CHECK (min_stock >= 0),
  avg_cost NUMERIC CHECK (avg_cost IS NULL OR avg_cost >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_colour UNIQUE (product_id, colour)
);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.variants(product_id);

-- 9. Images
CREATE TABLE IF NOT EXISTS public.images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES public.variants(id) ON DELETE SET NULL,
  original_path TEXT NOT NULL,
  web_path TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_images_product_sort ON public.images(product_id, sort_order, id);

-- 10. Purchases (Stock receipts)
CREATE TABLE IF NOT EXISTS public.purchases (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES public.suppliers(id),
  received_on DATE NOT NULL,
  reference TEXT,
  notes TEXT,
  total_cost NUMERIC CHECK (total_cost IS NULL OR total_cost >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Stock Movements (Audit log for inventory)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id SERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id INTEGER NOT NULL REFERENCES public.products(id),
  variant_id INTEGER NOT NULL REFERENCES public.variants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'purchase_received', 'sale', 'customer_return', 'customer_return_damaged',
    'supplier_return', 'damage_loss', 'manual_correction'
  )),
  quantity_change INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL CHECK (previous_qty >= 0),
  new_qty INTEGER NOT NULL CHECK (new_qty >= 0),
  non_sellable_qty INTEGER NOT NULL DEFAULT 0 CHECK (non_sellable_qty >= 0),
  unit_cost NUMERIC CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reason TEXT,
  order_id INTEGER,
  purchase_id INTEGER REFERENCES public.purchases(id),
  user_id INTEGER REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_on ON public.stock_movements(occurred_on);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id);

-- 12. Enquiries (WhatsApp clicks / manual customer inquiries)
CREATE TABLE IF NOT EXISTS public.enquiries (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  product_id INTEGER REFERENCES public.products(id),
  variant_id INTEGER REFERENCES public.variants(id),
  status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'received', 'converted', 'closed')),
  source TEXT,
  customer_name TEXT,
  customer_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_on DATE NOT NULL DEFAULT CURRENT_DATE,
  confirmed_at TIMESTAMPTZ,
  order_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_enquiries_on ON public.enquiries(created_on);

-- 13. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT,
  customer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'enquiry', 'pending', 'confirmed', 'processing', 'ready',
    'completed', 'cancelled', 'partially_returned', 'returned'
  )),
  notes TEXT,
  enquiry_id INTEGER REFERENCES public.enquiries(id),
  cancel_reason TEXT,
  completed_on DATE,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(order_date);

-- 14. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id),
  variant_id INTEGER NOT NULL REFERENCES public.variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_discount NUMERIC NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  stock_state TEXT NOT NULL DEFAULT 'none' CHECK (stock_state IN ('none', 'reserved', 'sold', 'released')),
  unit_cost_at_sale NUMERIC CHECK (unit_cost_at_sale IS NULL OR unit_cost_at_sale >= 0),
  sold_on DATE,
  returned_qty INTEGER NOT NULL DEFAULT 0 CHECK (returned_qty >= 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_sold ON public.order_items(sold_on);

-- 15. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  note TEXT,
  user_id INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Returns
CREATE TABLE IF NOT EXISTS public.returns (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES public.order_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  condition TEXT NOT NULL CHECK (condition IN ('sellable', 'damaged')),
  returned_on DATE NOT NULL DEFAULT CURRENT_DATE,
  refund_value NUMERIC NOT NULL CHECK (refund_value >= 0),
  reason TEXT,
  user_id INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id SERIAL PRIMARY KEY,
  expense_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  payment_method TEXT,
  supplier_id INTEGER REFERENCES public.suppliers(id),
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_on ON public.expenses(expense_on);

-- 18. Savings Entries
CREATE TABLE IF NOT EXISTS public.savings_entries (
  id SERIAL PRIMARY KEY,
  entry_on DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL CHECK (direction IN ('deposit', 'withdrawal')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON public.audit_logs(at);

-- 20. OTPs (Email verification codes)
CREATE TABLE IF NOT EXISTS public.otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_user ON public.otps(user_id);
