-- ============================================================
-- LEIZ STORE - Migration 004: Add customer_phone to order table
-- ============================================================
-- Adds phone number field for WhatsApp invoice delivery
-- ============================================================

ALTER TABLE public.order
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Update RLS to include the new column (existing policies cover all columns)
