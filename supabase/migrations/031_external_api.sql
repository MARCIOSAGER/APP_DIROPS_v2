-- =============================================
-- 031: External API - API Keys, Rate Limiting, Audit Log
-- =============================================

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- e.g., "Power BI Production"
  key_hash TEXT NOT NULL UNIQUE,            -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL,                 -- First 8 chars for identification (e.g., "dk_a1b2c3d4")
  scopes TEXT[] NOT NULL DEFAULT '{}',      -- e.g., '{voo, ordem_servico, inspecao}'
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,                   -- NULL = never expires
  last_used_at TIMESTAMPTZ,
  allowed_ips TEXT[],                       -- NULL = any IP allowed
  created_by TEXT,                          -- email of admin who created
  created_date TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT
);

-- API Access Audit Log
CREATE TABLE IF NOT EXISTS public.api_access_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_key(id),
  empresa_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  ip_address TEXT,
  user_agent TEXT,
  status_code INT,
  response_time_ms INT,
  rows_returned INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DB-backed rate limiting
CREATE TABLE IF NOT EXISTS public.api_rate_limit (
  key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key_hash, window_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON public.api_key(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_key_empresa ON public.api_key(empresa_id);
CREATE INDEX IF NOT EXISTS idx_api_access_log_key ON public.api_access_log(api_key_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_access_log_empresa ON public.api_access_log(empresa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_cleanup ON public.api_rate_limit(window_start);

-- Rate limit check function (atomic upsert + check)
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key_hash TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  current_count INT;
BEGIN
  INSERT INTO public.api_rate_limit (key_hash, window_start, request_count)
  VALUES (p_key_hash, p_window_start, 1)
  ON CONFLICT (key_hash, window_start)
  DO UPDATE SET request_count = api_rate_limit.request_count + 1
  RETURNING request_count INTO current_count;

  RETURN current_count <= p_max_requests;
END;
$$;

-- Cleanup old rate limit entries (call periodically)
CREATE OR REPLACE FUNCTION public.cleanup_api_rate_limits()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.api_rate_limit WHERE window_start < now() - interval '5 minutes';
$$;

-- RLS
ALTER TABLE public.api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_access_log ENABLE ROW LEVEL SECURITY;

-- api_key policies
CREATE POLICY "api_key_select" ON public.api_key
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "api_key_insert" ON public.api_key
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "api_key_update" ON public.api_key
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "api_key_delete" ON public.api_key
  FOR DELETE TO authenticated
  USING (true);

-- api_access_log policies
CREATE POLICY "api_log_select" ON public.api_access_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "api_log_insert" ON public.api_access_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow service_role full access (Edge Functions use this)
CREATE POLICY "api_key_service" ON public.api_key
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "api_log_service" ON public.api_access_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "api_rate_service" ON public.api_rate_limit
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;
