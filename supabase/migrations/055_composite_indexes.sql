-- 055: Composite indexes for primary Operacoes and fetchCalculoMap query patterns
--
-- Gap analysis (migrations 021, 032 already exist):
--   voo: idx_voo_empresa_data(empresa_id, data_operacao) exists but excludes deleted_at
--        Operacoes query filters WHERE deleted_at IS NULL AND empresa_id = $1 ORDER BY data_operacao DESC
--        → need 3-column covering index
--   calculo_tarifa: idx_calculo_tarifa_empresa_id(empresa_id) and idx_calculo_tarifa_voo(voo_id) exist separately
--        fetchCalculoMap filters WHERE empresa_id = $1 and uses voo_id for Map construction
--        → need composite (empresa_id, voo_id) for index-only scan on the SELECT columns
--
-- Use CREATE INDEX CONCURRENTLY to avoid table locks on production.
-- IF NOT EXISTS is idempotent — safe to re-run.

-- Index 1: Operacoes primary voo query
-- Covers: WHERE empresa_id = $1 AND deleted_at IS NULL ORDER BY data_operacao DESC
-- Column order: empresa_id first (equality), deleted_at second (equality/IS NULL), data_operacao last (range/sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voo_empresa_deleted_data
  ON public.voo (empresa_id, deleted_at, data_operacao DESC);

-- Index 2: fetchCalculoMap and dashboard calculo_tarifa subqueries
-- Covers: WHERE empresa_id = $1 (filter) with voo_id in SELECT list (index-only scan)
-- Also covers: the dashboard_stats_full EXISTS(SELECT 1 FROM calculo_tarifa WHERE empresa_id AND voo_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculo_tarifa_empresa_voo
  ON public.calculo_tarifa (empresa_id, voo_id);

-- Verification queries (run via Supabase SQL editor after applying):
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename IN ('voo', 'calculo_tarifa')
--   AND indexname IN ('idx_voo_empresa_deleted_data', 'idx_calculo_tarifa_empresa_voo');
--
-- EXPLAIN ANALYZE
--   SELECT id, data_operacao, tipo_movimento, status, callsign, aeroporto_operacao,
--          passageiros_total, empresa_id, deleted_at
--   FROM voo
--   WHERE empresa_id = '<your-empresa-uuid>'
--     AND deleted_at IS NULL
--   ORDER BY data_operacao DESC
--   LIMIT 500;
--
-- EXPLAIN ANALYZE
--   SELECT voo_id, voo_ligado_id, total_tarifa_usd, total_tarifa, tipo_tarifa, taxa_cambio_usd_aoa
--   FROM calculo_tarifa
--   WHERE empresa_id = '<your-empresa-uuid>'
--   LIMIT 500;
