-- LEIZ STORE - Migration 007: durable invoice paths and queue hardening
-- Apply after 006_payment_security.sql.

ALTER TABLE public.invoice
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

ALTER TABLE public.job_queue
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_dedupe_active
  ON public.job_queue(type, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING');

-- Recover jobs abandoned by a crashed worker. The status update is atomic and
-- makes the job eligible for the existing claim function again.
CREATE OR REPLACE FUNCTION public.recover_stale_jobs(p_lease_seconds INTEGER DEFAULT 300)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recovered INTEGER;
BEGIN
  UPDATE public.job_queue
     SET status = 'PENDING',
         started_at = NULL,
         lease_expires_at = NULL,
         scheduled_at = NOW(),
         last_error = COALESCE(last_error || E'\n', '') || 'Recovered after worker lease expired',
         updated_at = NOW()
   WHERE status = 'PROCESSING'
     AND (
       started_at IS NULL
       OR COALESCE(lease_expires_at, started_at + make_interval(secs => p_lease_seconds)) <= NOW()
     );

  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_jobs(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_stale_jobs(INTEGER) TO service_role;

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
     SET status = 'PROCESSING',
         started_at = NOW(),
         lease_expires_at = NOW() + INTERVAL '5 minutes',
         updated_at = NOW()
    FROM candidate
   WHERE q.id = candidate.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_job(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_job(TEXT[]) TO service_role;
