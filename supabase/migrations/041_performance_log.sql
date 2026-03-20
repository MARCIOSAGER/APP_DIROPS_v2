-- Migration 041: performance_log table for Web Vitals from real users
CREATE TABLE IF NOT EXISTS performance_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metric_name TEXT NOT NULL,       -- LCP, CLS, FCP, TTFB, INP
  metric_value FLOAT NOT NULL,     -- in milliseconds (or unitless for CLS)
  rating TEXT,                     -- good | needs-improvement | poor
  page_path TEXT NOT NULL,         -- e.g. /Home, /Operacoes
  navigation_type TEXT,            -- navigate | reload | back-forward
  connection_type TEXT,            -- effective network type (4g, 3g, etc.)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES empresa(id) ON DELETE SET NULL
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_performance_log_created_at ON performance_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_log_metric_name ON performance_log(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_log_page_path ON performance_log(page_path);

-- RLS
ALTER TABLE performance_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own metrics
CREATE POLICY "authenticated can insert performance_log"
  ON performance_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only superadmin (no empresa_id) can read all
CREATE POLICY "superadmin can read performance_log"
  ON performance_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.empresa_id IS NULL
    )
  );
