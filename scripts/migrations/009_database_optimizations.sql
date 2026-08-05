-- ============================================================
-- LEIZ STORE - Migration 009: index & data-consistency optimization
-- Apply after 008_order_idempotency.sql.
-- NOTE: depends on tables created by 003_invoice.sql (whatsapp_queue,
-- job_queue) and 005_security_atomic_orders.sql (order_log).
--
-- Goals, in the project priority order:
--   1. Consistency : pin order.status vocabulary with a CHECK constraint so
--      the DB rejects typos that the app state machine (STATUS_TRANSITIONS in
--      src/lib/payment/constants.ts) would otherwise let through.
--   2. Performance : add composite/partial indexes that match the real query
--      patterns found in src/lib (repositories, payment-service, queue).
--   3. Scalability : remove indexes that are provably redundant with the
--      index Postgres already maintains for a UNIQUE constraint.
-- ============================================================

-- ─── 1. Drop redundant indexes ──────────────────────────────
-- Each of these is fully covered by the index backing a UNIQUE constraint
-- (or by a composite index added below), so it is pure write amplification.
--   idx_user_email              <- user.email UNIQUE
--   idx_category_slug           <- category.slug UNIQUE
--   idx_product_slug            <- product.slug UNIQUE
--   idx_order_number            <- order.order_number UNIQUE
--   idx_wishlist_user           <- wishlist UNIQUE(user_id, product_id) leftmost prefix
--   idx_customer_segment_user   <- customer_segment UNIQUE(user_id)
--   idx_analytics_event_name    <- replaced by idx_analytics_event_event_created below
--   idx_order_status            <- subsumed by idx_order_status_created (leading col)

DROP INDEX IF EXISTS public.idx_user_email;
DROP INDEX IF EXISTS public.idx_category_slug;
DROP INDEX IF EXISTS public.idx_product_slug;
DROP INDEX IF EXISTS public.idx_order_number;
DROP INDEX IF EXISTS public.idx_wishlist_user;
DROP INDEX IF EXISTS public.idx_customer_segment_user;
DROP INDEX IF EXISTS public.idx_analytics_event_name;
DROP INDEX IF EXISTS public.idx_order_status;

-- ─── 2. New indexes for real query patterns ─────────────────

-- Admin order list: filter by status, sort newest first.
CREATE INDEX IF NOT EXISTS idx_order_status_created
  ON public.order(status, created_at DESC);

-- Admin order list: filter by store, sort newest first.
CREATE INDEX IF NOT EXISTS idx_order_store_created
  ON public.order(store_id, created_at DESC);

-- order_log is appended per order and read back per order; no index existed.
CREATE INDEX IF NOT EXISTS idx_order_log_order
  ON public.order_log(order_id, created_at DESC);

-- WhatsApp queue: worker polls by status and invoice lookup is per order.
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_order
  ON public.whatsapp_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_created
  ON public.whatsapp_queue(status, created_at);

-- Payments: admin list filtered by status.
CREATE INDEX IF NOT EXISTS idx_payment_status ON public.payment(status);

-- Analytics counts are grouped by event over a created_at window
-- (analyticsRepository.getEventCounts).
CREATE INDEX IF NOT EXISTS idx_analytics_event_event_created
  ON public.analytics_event(event, created_at DESC);

-- Inventory history is read per product, newest first.
CREATE INDEX IF NOT EXISTS idx_inventory_log_product_created
  ON public.inventory_log(product_id, created_at DESC);

-- Activity feed per store.
CREATE INDEX IF NOT EXISTS idx_activity_log_store_created
  ON public.activity_log(store_id, created_at DESC);

-- Forecast lookup/upsert per product+period.
CREATE INDEX IF NOT EXISTS idx_forecast_product_period
  ON public.sales_forecast(product_id, period);

-- Queue claim (claim_next_job): type-filtered polls are the hot path.
-- The existing partial index idx_job_queue_scheduled covers the no-type case;
-- this one covers polls filtered by type.
CREATE INDEX IF NOT EXISTS idx_job_queue_type_claim
  ON public.job_queue(type, priority DESC, created_at)
  WHERE status = 'PENDING';

-- Product search: productRepository.search issues ILIKE '%term%' on name and
-- description, which is a sequential scan today. A trigram GIN index turns it
-- into an index scan. Requires pg_trgm (allowed on Supabase).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_product_search_trgm
  ON public.product
  USING GIN (name gin_trgm_ops, description gin_trgm_ops);

-- ─── 3. Pin order.status vocabulary ─────────────────────────
-- Vocabulary mirrors the keys of STATUS_TRANSITIONS in
-- src/lib/payment/constants.ts. The constraint is added only when every
-- existing row already conforms, so this upgrade is safe on live data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'order_status_check'
       AND conrelid = 'public.order'::regclass
  ) THEN
    RAISE NOTICE 'order_status_check already exists; skipping';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order
     WHERE status NOT IN (
       'PENDING', 'PENDING_PAYMENT', 'WAITING_PAYMENT', 'WAITING_CONFIRMATION',
       'PAID', 'PROCESSING', 'NEEDS_REVIEW', 'REJECTED', 'COMPLETED',
       'CANCELLED', 'FORCE_CANCELLED', 'REFUNDED', 'EXPIRED'
     )
  ) THEN
    RAISE WARNING 'order.status contains values outside the known vocabulary; '
                  'constraint not added. Review offending rows first.';
  ELSE
    ALTER TABLE public.order
      ADD CONSTRAINT order_status_check CHECK (
        status IN (
          'PENDING', 'PENDING_PAYMENT', 'WAITING_PAYMENT', 'WAITING_CONFIRMATION',
          'PAID', 'PROCESSING', 'NEEDS_REVIEW', 'REJECTED', 'COMPLETED',
          'CANCELLED', 'FORCE_CANCELLED', 'REFUNDED', 'EXPIRED'
        )
      );
    RAISE NOTICE 'order_status_check added';
  END IF;
END $$;
