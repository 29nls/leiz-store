-- LEIZ STORE - Migration 010: revoke anonymous INSERT RLS policies on orders
-- Apply after 008_order_idempotency.sql (and 009_database_optimizations.sql if present).
--
-- Security audit HIGH-2 (2026-08-05):
-- The base schema granted anon/authenticated clients INSERT on order/order_item/payment
-- with WITH CHECK (true). Because the anon key is public, anyone could forge order,
-- item, and payment rows via the Supabase REST API, bypassing server-side pricing,
-- stock, and idempotency logic.
--
-- Verification performed before removing these policies: every legitimate write to
-- order/order_item/payment flows through the server using the service_role key:
--   - Checkout:      create_order_atomic RPC (EXECUTE granted to service_role only)
--   - Payment flow:  /api/orders/* -> src/lib/payment/payment-service.ts (supabaseAdmin)
--   - Admin actions: /api/admin/* (supabaseAdmin)
-- The browser/anon client only ever READS these tables (admin orders pages).
--
-- service_role bypasses RLS (BYPASSRLS), so server-side writes keep working with
-- or without these policies. Removing them only closes the anon write path.

DROP POLICY IF EXISTS "Insert order"     ON public.order;
DROP POLICY IF EXISTS "Insert order_item" ON public.order_item;
DROP POLICY IF EXISTS "Insert payment"   ON public.payment;

-- Sanity: confirm the anon write policies are gone (should return 0 rows).
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('order', 'order_item', 'payment')
     AND cmd = 'INSERT'
     AND (roles::text ILIKE '%anon%' OR roles::text ILIKE '%public%');
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration 010 incomplete: % anon INSERT policy(ies) remain on order/order_item/payment', remaining;
  END IF;
END;
$$;
