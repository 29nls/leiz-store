-- ============================================================
-- LEIZ STORE - Migration 003: Invoice & WhatsApp Queue
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.order(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  pdf_url TEXT,
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

CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.order(id) ON DELETE SET NULL,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoice_order ON public.invoice(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON public.invoice(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON public.whatsapp_queue(status);

ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage invoices" ON public.invoice
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin manage whatsapp_queue" ON public.whatsapp_queue
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice;

-- ============================================================
-- Job Queue for background processing with retry
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_queue (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_type ON public.job_queue(type);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON public.job_queue(scheduled_at)
  WHERE status = 'PENDING';

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage job_queue" ON public.job_queue
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
