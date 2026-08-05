-- ============================================================
-- LEIZ STORE - Supabase Database Schema (TEXT IDs for JSON compat)
--
-- Consolidated baseline matching the FINAL state produced by applying
-- migrations 003_invoice.sql through 009_database_optimizations.sql:
--   * invoice, whatsapp_queue, job_queue        (migration 003 + 007 columns)
--   * payment_confirmation, order_log           (migration 005)
--   * order.customer_phone                      (migration 004)
--   * order.expiry_at partial index             (migration 005)
--   * index optimization set                    (migration 009)
--
-- Stored functions (create_order_atomic, claim_next_job,
-- recover_stale_jobs) and storage buckets intentionally remain owned by the
-- migrations; after applying this file, still run every migration in order.
-- ============================================================

-- ─── Stores ──────────────────────────────────────────────────
DROP TABLE IF EXISTS public.currency_rate CASCADE;
DROP TABLE IF EXISTS public.wishlist CASCADE;
DROP TABLE IF EXISTS public.inventory_log CASCADE;
DROP TABLE IF EXISTS public.activity_log CASCADE;
DROP TABLE IF EXISTS public.banner CASCADE;
DROP TABLE IF EXISTS public.faq CASCADE;
DROP TABLE IF EXISTS public.testimonial CASCADE;
DROP TABLE IF EXISTS public.setting CASCADE;
DROP TABLE IF EXISTS public.notification CASCADE;
DROP TABLE IF EXISTS public.stock_alert CASCADE;
DROP TABLE IF EXISTS public.product_recommendation CASCADE;
DROP TABLE IF EXISTS public.customer_segment CASCADE;
DROP TABLE IF EXISTS public.sales_forecast CASCADE;
DROP TABLE IF EXISTS public.analytics_event CASCADE;
DROP TABLE IF EXISTS public.job_queue CASCADE;
DROP TABLE IF EXISTS public.whatsapp_queue CASCADE;
DROP TABLE IF EXISTS public.invoice CASCADE;
DROP TABLE IF EXISTS public.order_log CASCADE;
DROP TABLE IF EXISTS public.payment_confirmation CASCADE;
DROP TABLE IF EXISTS public.payment CASCADE;
DROP TABLE IF EXISTS public.order_idempotency CASCADE;
DROP TABLE IF EXISTS public.order_item CASCADE;
DROP TABLE IF EXISTS public.order CASCADE;
DROP TABLE IF EXISTS public.product_image CASCADE;
DROP TABLE IF EXISTS public.product CASCADE;
DROP TABLE IF EXISTS public.category CASCADE;
DROP TABLE IF EXISTS public.refresh_token CASCADE;
DROP TABLE IF EXISTS public.user CASCADE;
DROP TABLE IF EXISTS public.store CASCADE;

CREATE TABLE public.store (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo TEXT,
  favicon TEXT,
  domain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user (
  id TEXT PRIMARY KEY,
  public_id TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  avatar TEXT,
  discord TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.refresh_token (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.category (
  id TEXT PRIMARY KEY,
  public_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_id TEXT REFERENCES public.category(id) ON DELETE SET NULL,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product (
  id TEXT PRIMARY KEY,
  public_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price DOUBLE PRECISION NOT NULL,
  price_usd DOUBLE PRECISION,
  compare_price DOUBLE PRECISION,
  compare_price_usd DOUBLE PRECISION,
  unit TEXT NOT NULL DEFAULT 'pc',
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  badge TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  tags JSONB,
  category_id TEXT NOT NULL REFERENCES public.category(id) ON DELETE RESTRICT,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.product_image (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.order (
  id TEXT PRIMARY KEY,
  public_id TEXT,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_discord TEXT,
  customer_ign TEXT,
  customer_notes TEXT,
  customer_phone TEXT,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  subtotal_usd DOUBLE PRECISION,
  tax DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_usd DOUBLE PRECISION,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount_usd DOUBLE PRECISION,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_usd DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_method TEXT,
  payment_proof TEXT,
  buyer_discord_id TEXT,
  payment_confirmation_token_hash TEXT,
  expiry_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  user_id TEXT REFERENCES public.user(id) ON DELETE SET NULL,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Vocabulary matches migration 009 (STATUS_TRANSITIONS in constants.ts).
  CONSTRAINT order_status_check CHECK (status IN (
    'PENDING', 'PENDING_PAYMENT', 'WAITING_PAYMENT', 'WAITING_CONFIRMATION',
    'PAID', 'PROCESSING', 'NEEDS_REVIEW', 'REJECTED', 'COMPLETED',
    'CANCELLED', 'FORCE_CANCELLED', 'REFUNDED', 'EXPIRED'
  ))
);

CREATE TABLE public.order_item (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  price_usd DOUBLE PRECISION,
  quantity INTEGER NOT NULL DEFAULT 1,
  total DOUBLE PRECISION NOT NULL,
  total_usd DOUBLE PRECISION
);

CREATE TABLE public.order_idempotency (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  order_id TEXT NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
  encrypted_payment_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_idempotency_status_check CHECK (status IN ('COMPLETED')),
  CONSTRAINT order_idempotency_key_length CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
  CONSTRAINT order_idempotency_key_format CHECK (idempotency_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT order_idempotency_fingerprint_length CHECK (char_length(request_fingerprint) = 64),
  CONSTRAINT order_idempotency_fingerprint_format CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_idempotency_scope_key_unique UNIQUE (scope, idempotency_key)
);

CREATE TABLE public.payment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  amount_usd DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  proof TEXT,
  account_number TEXT,
  account_name TEXT,
  notes TEXT,
  verified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per buyer-submitted transfer confirmation (migration 005).
CREATE TABLE public.payment_confirmation (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.order(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_discord_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable audit trail of order status transitions (migration 005).
CREATE TABLE public.order_log (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice per order, 1:1 (migration 003; pdf_path from 007).
CREATE TABLE public.invoice (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.order(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  pdf_url TEXT,
  pdf_path TEXT,
  sent_via_email BOOLEAN NOT NULL DEFAULT FALSE,
  sent_via_wa BOOLEAN NOT NULL DEFAULT FALSE,
  email_status TEXT DEFAULT 'PENDING',
  wa_status TEXT DEFAULT 'PENDING',
  error_log JSONB,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Outbound WhatsApp message queue for invoice delivery (migration 003).
CREATE TABLE public.whatsapp_queue (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.order(id) ON DELETE SET NULL,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Durable background job queue (migration 003; dedupe/lease from 007).
CREATE TABLE public.job_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  priority INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dedupe_key TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.analytics_event (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  user_id TEXT,
  metadata JSONB,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sales_forecast (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  category_id TEXT,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  predicted_value DOUBLE PRECISION NOT NULL,
  actual_value DOUBLE PRECISION,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  algorithm TEXT NOT NULL DEFAULT 'moving_average_7d',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.customer_segment (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
  segment TEXT NOT NULL,
  rfm_score TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 0,
  monetary DOUBLE PRECISION NOT NULL DEFAULT 0,
  recency_days INTEGER NOT NULL DEFAULT 999,
  lifetime_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE public.product_recommendation (
  id TEXT PRIMARY KEY,
  source_product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  recommended_product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  algorithm TEXT NOT NULL DEFAULT 'association',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.stock_alert (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'LOW_STOCK',
  threshold INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_via TEXT,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notification (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  metadata JSONB,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.setting (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  group_name TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE public.testimonial (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.faq (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.banner (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image TEXT NOT NULL,
  link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.user(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  store_id TEXT REFERENCES public.store(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.inventory_log (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL DEFAULT 0,
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reference TEXT,
  user_id TEXT REFERENCES public.user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.wishlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE public.currency_rate (
  id TEXT PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────
-- Single source of truth, matching the final state after migration 009.
-- UNIQUE constraints already create their backing indexes, so the redundant
-- hand-written ones (idx_user_email, idx_category_slug, idx_product_slug,
-- idx_order_number, idx_wishlist_user, idx_customer_segment_user,
-- idx_analytics_event_name, idx_order_status) are intentionally omitted.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_user_store ON public.user(store_id);
CREATE INDEX idx_category_parent ON public.category(parent_id);
CREATE INDEX idx_category_store ON public.category(store_id);
CREATE INDEX idx_product_category ON public.product(category_id);
CREATE INDEX idx_product_store ON public.product(store_id);
CREATE INDEX idx_product_active ON public.product(is_active);
CREATE INDEX idx_product_featured ON public.product(is_featured);
CREATE INDEX idx_product_image_product ON public.product_image(product_id);
CREATE INDEX idx_order_status_created ON public.order(status, created_at DESC);
CREATE INDEX idx_order_store_created ON public.order(store_id, created_at DESC);
CREATE INDEX idx_order_user ON public.order(user_id);
CREATE INDEX idx_order_store ON public.order(store_id);
CREATE INDEX idx_order_created ON public.order(created_at);
CREATE INDEX idx_order_expiry ON public.order(expiry_at)
  WHERE status IN ('PENDING_PAYMENT', 'WAITING_CONFIRMATION');
CREATE INDEX idx_order_item_order ON public.order_item(order_id);
CREATE INDEX idx_order_item_product ON public.order_item(product_id);
CREATE INDEX idx_order_idempotency_expires ON public.order_idempotency(expires_at);
CREATE INDEX idx_order_idempotency_order ON public.order_idempotency(order_id);
CREATE INDEX idx_order_log_order ON public.order_log(order_id, created_at DESC);
CREATE INDEX idx_payment_order ON public.payment(order_id);
CREATE INDEX idx_payment_status ON public.payment(status);
CREATE INDEX idx_analytics_event_event_created ON public.analytics_event(event, created_at DESC);
CREATE INDEX idx_analytics_event_created ON public.analytics_event(created_at);
CREATE INDEX idx_stock_alert_product ON public.stock_alert(product_id);
CREATE INDEX idx_stock_alert_unread ON public.stock_alert(is_read);
CREATE INDEX idx_notification_store ON public.notification(store_id);
CREATE INDEX idx_notification_status ON public.notification(status);
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_action ON public.activity_log(action);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at);
CREATE INDEX idx_activity_log_store_created ON public.activity_log(store_id, created_at DESC);
CREATE INDEX idx_inventory_log_product ON public.inventory_log(product_id);
CREATE INDEX idx_inventory_log_created ON public.inventory_log(created_at);
CREATE INDEX idx_inventory_log_product_created ON public.inventory_log(product_id, created_at DESC);
CREATE INDEX idx_wishlist_product ON public.wishlist(product_id);
CREATE INDEX idx_customer_segment_name ON public.customer_segment(segment);
CREATE INDEX idx_forecast_store ON public.sales_forecast(store_id);
CREATE INDEX idx_forecast_product_period ON public.sales_forecast(product_id, period);
CREATE INDEX idx_recommendation_source ON public.product_recommendation(source_product_id);
CREATE INDEX idx_recommendation_target ON public.product_recommendation(recommended_product_id);
CREATE INDEX idx_invoice_order ON public.invoice(order_id);
CREATE INDEX idx_invoice_status ON public.invoice(status);
CREATE INDEX idx_whatsapp_queue_order ON public.whatsapp_queue(order_id);
CREATE INDEX idx_whatsapp_queue_status ON public.whatsapp_queue(status);
CREATE INDEX idx_whatsapp_queue_status_created ON public.whatsapp_queue(status, created_at);
CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_type ON public.job_queue(type);
CREATE INDEX idx_job_queue_scheduled ON public.job_queue(scheduled_at)
  WHERE status = 'PENDING';
CREATE UNIQUE INDEX idx_job_queue_dedupe_active
  ON public.job_queue(type, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING');
CREATE INDEX idx_job_queue_type_claim
  ON public.job_queue(type, priority DESC, created_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_product_search_trgm
  ON public.product USING GIN (name gin_trgm_ops, description gin_trgm_ops);

-- ─── Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_image ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_confirmation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alert ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rate ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────
CREATE POLICY "Public read" ON public.store FOR SELECT USING (true);
-- User profiles contain private email/password fields; never expose them publicly.
CREATE POLICY "Users read own profile" ON public.user
  FOR SELECT USING (auth.email() IS NOT NULL AND lower(email) = lower(auth.email()));
CREATE POLICY "Public read" ON public.category FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.product FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.product_image FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.testimonial FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.faq FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.setting FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.banner FOR SELECT USING (true);

-- Order writes are intentionally NOT granted to anon/authenticated clients.
-- All order/order_item/payment writes flow through the server (service_role):
--   - Checkout: create_order_atomic RPC (EXECUTE granted to service_role only)
--   - Payment flow: /api/orders/* -> payment-service.ts (supabaseAdmin)
--   - Admin actions: /api/admin/* (supabaseAdmin)
-- The previous anon INSERT policies (WITH CHECK (true)) let anyone with the
-- public anon key forge order/item/payment rows via the REST API, bypassing
-- server-side pricing, stock, and idempotency logic. They were removed on
-- 2026-08-05 (security audit HIGH-2). Existing deployments must drop them:
--   DROP POLICY IF EXISTS "Insert order" ON public.order;
--   DROP POLICY IF EXISTS "Insert order_item" ON public.order_item;
--   DROP POLICY IF EXISTS "Insert payment" ON public.payment;

-- ─── Admin Full Access Policies (email-based, no UUID mismatch) ───
-- Note: public.user.id uses TEXT/cuid format, NOT postgres UUID.
-- We use auth.email() instead of auth.uid() to avoid format mismatch.

-- Create helper function to check if the authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (SELECT role = 'ADMIN' FROM public.user WHERE email = auth.email() LIMIT 1),
      FALSE
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin full access policies for all admin-managed tables
-- The PUBLIC read policies above cover unauthenticated reads.
-- These policies ADD the ability for admin users to INSERT/UPDATE/DELETE.

-- Products & Images
CREATE POLICY "Admin manage products" ON public.product FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage product_images" ON public.product_image FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Categories
CREATE POLICY "Admin manage categories" ON public.category FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orders, Items, Payments, Confirmations & Logs
CREATE POLICY "Admin manage orders" ON public.order FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage order_items" ON public.order_item FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage order idempotency" ON public.order_idempotency FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage payments" ON public.payment FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage payment confirmations" ON public.payment_confirmation FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage order logs" ON public.order_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.order_idempotency FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_idempotency TO service_role;

-- Invoices, WhatsApp queue & job queue (server/admin-only data)
CREATE POLICY "Admin manage invoices" ON public.invoice FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage whatsapp_queue" ON public.whatsapp_queue FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage job_queue" ON public.job_queue FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Settings & Content
CREATE POLICY "Admin manage settings" ON public.setting FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage testimonials" ON public.testimonial FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage faqs" ON public.faq FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage banners" ON public.banner FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Inventory & Activity Logs
CREATE POLICY "Admin manage inventory" ON public.inventory_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage activity" ON public.activity_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage stock_alerts" ON public.stock_alert FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage notifications" ON public.notification FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Users (admin can read, but NOT modify passwords)
CREATE POLICY "Admin read users" ON public.user FOR SELECT USING (public.is_admin());

-- Analytics & ML tables
CREATE POLICY "Admin manage analytics" ON public.analytics_event FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage forecasts" ON public.sales_forecast FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage segments" ON public.customer_segment FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage recommendations" ON public.product_recommendation FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Store, Currency, Refresh Tokens, Wishlist
CREATE POLICY "Admin manage stores" ON public.store FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage currencies" ON public.currency_rate FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage refresh_tokens" ON public.refresh_token FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage wishlist" ON public.wishlist FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Enable realtime for key tables so admin can get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.product;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_item;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_image;
ALTER PUBLICATION supabase_realtime ADD TABLE public.setting;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice;
