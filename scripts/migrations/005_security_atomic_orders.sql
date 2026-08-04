-- LEIZ STORE - Migration 005: security and atomic checkout
-- Apply after 003_invoice.sql and 004_customer_phone.sql.

-- The previous policy exposed every user's email, password hash, and profile.
DROP POLICY IF EXISTS "Public read" ON public.user;
DROP POLICY IF EXISTS "Users read own profile" ON public.user;
DROP POLICY IF EXISTS "Admin read users" ON public.user;

-- Profiles contain password hashes and are therefore server/admin-only.
CREATE POLICY "Admin read users" ON public.user
  FOR SELECT
  USING (public.is_admin());

-- Keep writes server-only through the service role. No anon INSERT/UPDATE/DELETE
-- policies are intentionally created for this table.

-- These columns are used by the payment service but were absent from the base
-- schema. IF NOT EXISTS makes this migration safe on existing installations.
ALTER TABLE public.order ADD COLUMN IF NOT EXISTS buyer_discord_id TEXT;
ALTER TABLE public.order ADD COLUMN IF NOT EXISTS expiry_at TIMESTAMPTZ;
ALTER TABLE public.order ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.order ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_order_expiry ON public.order(expiry_at)
  WHERE status IN ('PENDING_PAYMENT', 'WAITING_CONFIRMATION');

CREATE TABLE IF NOT EXISTS public.payment_confirmation (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.order(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_discord_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_log (
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

ALTER TABLE public.payment_confirmation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage payment confirmations" ON public.payment_confirmation;
DROP POLICY IF EXISTS "Admin manage order logs" ON public.order_log;
CREATE POLICY "Admin manage payment confirmations" ON public.payment_confirmation
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin manage order logs" ON public.order_log
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Native transaction: product rows are locked in deterministic order, stock is
-- checked again inside the transaction, then order/items/logs are inserted.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order JSONB,
  p_items JSONB,
  p_tax_rate NUMERIC DEFAULT 0.11
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  product_row RECORD;
  order_id TEXT;
  order_number TEXT;
  subtotal NUMERIC := 0;
  tax NUMERIC;
  total NUMERIC;
  quantity INTEGER;
  item_total NUMERIC;
  created_order JSONB;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required' USING ERRCODE = '22023';
  END IF;

  -- Lock every requested product in id order to prevent deadlocks between
  -- concurrent carts containing the same products in different orderings.
  FOR product_row IN
    SELECT p.id, p.name, p.price, p.price_usd, p.stock, p.min_stock
    FROM public.product p
    WHERE p.id IN (SELECT value->>'product_id' FROM jsonb_array_elements(p_items))
    ORDER BY p.id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  IF (SELECT COUNT(*) FROM public.product p WHERE p.id IN (SELECT value->>'product_id' FROM jsonb_array_elements(p_items)))
     <> (SELECT COUNT(DISTINCT value->>'product_id') FROM jsonb_array_elements(p_items)) THEN
    RAISE EXCEPTION 'One or more products were not found' USING ERRCODE = 'P0002';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity := (item->>'quantity')::INTEGER;
    IF quantity IS NULL OR quantity < 1 THEN
      RAISE EXCEPTION 'Quantity must be at least 1' USING ERRCODE = '22023';
    END IF;

    SELECT p.id, p.name, p.price, p.price_usd, p.stock, p.min_stock
      INTO product_row
      FROM public.product p
     WHERE p.id = item->>'product_id'
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', item->>'product_id' USING ERRCODE = 'P0002';
    END IF;
    IF product_row.stock < quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', product_row.name USING ERRCODE = '22003';
    END IF;

    item_total := product_row.price * quantity;
    subtotal := subtotal + item_total;
  END LOOP;

  tax := ROUND(subtotal * GREATEST(0, p_tax_rate));
  total := subtotal + tax;
  order_id := COALESCE(NULLIF(p_order->>'id', ''), replace(gen_random_uuid()::text, '-', ''));
  order_number := COALESCE(NULLIF(p_order->>'order_number', ''), 'LZ-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6)));

  INSERT INTO public.order (
    id, order_number, status, customer_name, customer_discord,
    customer_ign, customer_notes, subtotal, subtotal_usd, tax, tax_usd,
    total, total_usd, currency, payment_method, user_id, buyer_discord_id,
    expiry_at, created_at, updated_at
  ) VALUES (
    order_id, order_number, COALESCE(NULLIF(p_order->>'status', ''), 'PENDING'),
    p_order->>'customer_name', NULLIF(p_order->>'customer_discord', ''),
    NULLIF(p_order->>'customer_ign', ''), NULLIF(p_order->>'customer_notes', ''),
    subtotal, subtotal * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    tax, tax * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    total, total * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    COALESCE(NULLIF(p_order->>'currency', ''), 'IDR'),
    NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'user_id', ''),
    NULLIF(p_order->>'buyer_discord_id', ''),
    NULLIF(p_order->>'expiry_at', '')::TIMESTAMPTZ,
    NOW(), NOW()
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT p.id, p.name, p.price, p.price_usd, p.stock, p.min_stock
      INTO product_row
      FROM public.product p WHERE p.id = item->>'product_id' FOR UPDATE;
    quantity := (item->>'quantity')::INTEGER;
    item_total := product_row.price * quantity;

    INSERT INTO public.order_item (
      id, order_id, product_id, name, price, price_usd, quantity, total, total_usd
    ) VALUES (
      replace(gen_random_uuid()::text, '-', ''), order_id, product_row.id,
      product_row.name, product_row.price, product_row.price_usd, quantity,
      item_total, item_total * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063)
    );

    UPDATE public.product
       SET stock = stock - quantity, updated_at = NOW()
     WHERE id = product_row.id;

    INSERT INTO public.inventory_log (
      id, product_id, change_amount, previous_stock, new_stock, reason, reference, created_at
    ) VALUES (
      replace(gen_random_uuid()::text, '-', ''), product_row.id, -quantity,
      product_row.stock, product_row.stock - quantity, 'ORDER', order_number, NOW()
    );
  END LOOP;

  SELECT to_jsonb(o) INTO created_order FROM public.order o WHERE o.id = order_id;
  RETURN created_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB, NUMERIC) TO service_role;

-- Atomically claim one due job so concurrent cron invocations cannot process it twice.
CREATE OR REPLACE FUNCTION public.claim_next_job(p_types TEXT[] DEFAULT NULL)
RETURNS SETOF public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id FROM public.job_queue
     WHERE status = 'PENDING'
       AND scheduled_at <= NOW()
       AND (p_types IS NULL OR type = ANY(p_types))
     ORDER BY priority DESC, created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.job_queue q
     SET status = 'PROCESSING', started_at = NOW(), updated_at = NOW()
    FROM candidate
   WHERE q.id = candidate.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_job(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_job(TEXT[]) TO service_role;
