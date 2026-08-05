-- ============================================================
-- LEIZ STORE - Migration 011: store buyer email for invoice delivery
-- Apply after 010_revoke_anon_inserts.sql (or after 008 on older installs).
--
-- The order.customer_email column ships in the baseline schema
-- (supabase-schema.sql) but is NOT added by any migration in this repo
-- (004 adds customer_phone; 005 adds buyer_discord_id/expiry_at/confirmed_at/
-- cancelled_at). It was never written either: create_order_atomic ignored it,
-- so no order carried a buyer email and the invoice-email feature had no
-- recipient. This migration (a) defensively ensures the column exists on any
-- live baseline, then (b) replaces the RPC with a version that persists
-- customer_email from p_order.customer_email (NULLIF '' -> NULL).
--
-- Idempotent: ALTER ... IF NOT EXISTS and DROP/CREATE OR REPLACE are all
-- safe to re-run; no existing rows are touched.
-- ============================================================

-- Self-healing guard for live DBs built from an older baseline.
ALTER TABLE public.order
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

DROP FUNCTION IF EXISTS public.create_order_atomic(JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order JSONB,
  p_items JSONB,
  p_tax_rate NUMERIC DEFAULT 0.11,
  p_idempotency_key TEXT DEFAULT NULL,
  p_request_fingerprint TEXT DEFAULT NULL,
  p_encrypted_payment_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  product_row RECORD;
  existing_idempotency RECORD;
  order_id TEXT;
  order_number TEXT;
  subtotal NUMERIC := 0;
  tax NUMERIC;
  total NUMERIC;
  quantity INTEGER;
  item_total NUMERIC;
  created_order JSONB;
  idempotency_scope CONSTANT TEXT := 'public-order-create';
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required' USING ERRCODE = '22023';
  END IF;

  -- A product may occur only once per order. Rejecting duplicates avoids
  -- checking each line against the original stock independently.
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_items))
     <> (SELECT COUNT(DISTINCT value->>'product_id') FROM jsonb_array_elements(p_items)) THEN
    RAISE EXCEPTION 'Duplicate products are not allowed' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF p_request_fingerprint IS NULL
       OR p_encrypted_payment_token IS NULL
       OR char_length(p_encrypted_payment_token) = 0
       OR char_length(p_idempotency_key) NOT BETWEEN 1 AND 128
       OR p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR p_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'Invalid idempotency request' USING ERRCODE = '22023';
    END IF;

    -- Serialize only requests sharing this logical key. This closes the race
    -- between checking an existing record and creating the order/stock rows.
    PERFORM pg_advisory_xact_lock(hashtextextended(idempotency_scope || ':' || p_idempotency_key, 0));

    SELECT * INTO existing_idempotency
      FROM public.order_idempotency
     WHERE scope = idempotency_scope
       AND idempotency_key = p_idempotency_key
     FOR UPDATE;

    IF FOUND THEN
      IF existing_idempotency.expires_at <= NOW() THEN
        RAISE EXCEPTION 'Idempotency key has expired' USING ERRCODE = '23505';
      ELSE
        IF existing_idempotency.request_fingerprint <> p_request_fingerprint THEN
          RAISE EXCEPTION 'Idempotency key was reused with a different request' USING ERRCODE = '23505';
        END IF;

        SELECT to_jsonb(o) INTO created_order
          FROM public.order o
         WHERE o.id = existing_idempotency.order_id;

        IF created_order IS NULL THEN
          RAISE EXCEPTION 'Idempotency record references a missing order' USING ERRCODE = 'P0001';
        END IF;

        RETURN jsonb_build_object(
          'order', created_order,
          'replayed', true,
          'encrypted_payment_token', existing_idempotency.encrypted_payment_token
        );
      END IF;
    END IF;
  END IF;

  -- Lock every requested product in deterministic order to prevent deadlocks
  -- between concurrent carts containing the same products in different orders.
  FOR product_row IN
    SELECT p.id, p.name, p.price, p.price_usd, p.stock, p.min_stock
      FROM public.product p
     WHERE p.id IN (SELECT value->>'product_id' FROM jsonb_array_elements(p_items))
     ORDER BY p.id
     FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  IF (SELECT COUNT(*)
        FROM public.product p
       WHERE p.id IN (SELECT value->>'product_id' FROM jsonb_array_elements(p_items)))
     <> (SELECT COUNT(DISTINCT value->>'product_id')
           FROM jsonb_array_elements(p_items)) THEN
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
  order_number := COALESCE(
    NULLIF(p_order->>'order_number', ''),
    'LZ-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6))
  );

  INSERT INTO public.order (
    id, order_number, status, customer_name, customer_email, customer_discord,
    customer_ign, customer_notes, subtotal, subtotal_usd, tax, tax_usd,
    total, total_usd, currency, payment_method, user_id, buyer_discord_id,
    payment_confirmation_token_hash, expiry_at, created_at, updated_at
  ) VALUES (
    order_id, order_number, COALESCE(NULLIF(p_order->>'status', ''), 'PENDING'),
    p_order->>'customer_name', NULLIF(p_order->>'customer_email', ''),
    NULLIF(p_order->>'customer_discord', ''),
    NULLIF(p_order->>'customer_ign', ''), NULLIF(p_order->>'customer_notes', ''),
    subtotal, subtotal * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    tax, tax * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    total, total * COALESCE(NULLIF((p_order->>'usd_rate')::NUMERIC, 0), 0.000063),
    COALESCE(NULLIF(p_order->>'currency', ''), 'IDR'),
    NULLIF(p_order->>'payment_method', ''), NULLIF(p_order->>'user_id', ''),
    NULLIF(p_order->>'buyer_discord_id', ''),
    NULLIF(p_order->>'payment_confirmation_token_hash', ''),
    NULLIF(p_order->>'expiry_at', '')::TIMESTAMPTZ,
    NOW(), NOW()
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT p.id, p.name, p.price, p.price_usd, p.stock, p.min_stock
      INTO product_row
      FROM public.product p
     WHERE p.id = item->>'product_id'
     FOR UPDATE;
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

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.order_idempotency (
      id, scope, idempotency_key, request_fingerprint, status, order_id,
      encrypted_payment_token, expires_at, created_at, updated_at
    ) VALUES (
      replace(gen_random_uuid()::text, '-', ''), idempotency_scope,
      p_idempotency_key, p_request_fingerprint, 'COMPLETED', order_id,
      p_encrypted_payment_token, NOW() + INTERVAL '7 days', NOW(), NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'order', created_order,
    'replayed', false,
    'encrypted_payment_token', p_encrypted_payment_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
