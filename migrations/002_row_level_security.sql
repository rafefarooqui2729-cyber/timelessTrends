-- TIMELESS TRENDS - Row Level Security (RLS) Policies
-- Migration: 002_row_level_security.sql

-- Enable RLS across all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Public Storefront Read Policies (Anonymous / Authenticated users)
-- Only published and active products are visible publicly
CREATE POLICY "Public can view published active products"
  ON public.products
  FOR SELECT
  USING (status = 'published' AND is_active = 1);

-- Variants of active products are viewable
CREATE POLICY "Public can view active variants"
  ON public.variants
  FOR SELECT
  USING (is_active = 1);

-- Product images are publicly viewable
CREATE POLICY "Public can view images"
  ON public.images
  FOR SELECT
  USING (true);

-- Active categories are publicly viewable
CREATE POLICY "Public can view active categories"
  ON public.categories
  FOR SELECT
  USING (is_active = 1);

-- Active promotional offers are publicly viewable
CREATE POLICY "Public can view active offers"
  ON public.offers
  FOR SELECT
  USING (is_active = 1);

-- Public enquiry logging (WhatsApp clicks)
CREATE POLICY "Public can insert enquiries"
  ON public.enquiries
  FOR INSERT
  WITH CHECK (true);

-- 2. Service Role & Authenticated Backend Access Policies
-- In Supabase, the backend server connecting via DATABASE_URL (postgres user) or service_role
-- has full operational access for administration and authenticated workflows.

CREATE POLICY "Service role full access products"
  ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access variants"
  ON public.variants FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access images"
  ON public.images FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access categories"
  ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access offers"
  ON public.offers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access enquiries"
  ON public.enquiries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access users"
  ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access sessions"
  ON public.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access otps"
  ON public.otps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access orders"
  ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access order_items"
  ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access payments"
  ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access returns"
  ON public.returns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access stock_movements"
  ON public.stock_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access purchases"
  ON public.purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access suppliers"
  ON public.suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access expenses"
  ON public.expenses FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access savings_entries"
  ON public.savings_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access audit_logs"
  ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access settings"
  ON public.settings FOR ALL TO service_role USING (true) WITH CHECK (true);
