-- Migration 015: Diagnóstico e limpeza de tarifas sem empresa_id
-- Executar no Supabase Dashboard SQL Editor

-- ==================== PASSO 1: DIAGNÓSTICO ====================

SELECT 'tarifa_pouso' as tabela, id, faixa_min, faixa_max, tarifa_internacional, tarifa_domestica, categoria_aeroporto, empresa_id
FROM public.tarifa_pouso WHERE empresa_id IS NULL;

SELECT 'tarifa_permanencia' as tabela, id, faixa_min, faixa_max, tarifa_usd_por_tonelada_hora, categoria_aeroporto, empresa_id
FROM public.tarifa_permanencia WHERE empresa_id IS NULL;

SELECT 'outra_tarifa' as tabela, id, tipo, tipo_operacao, valor, unidade, categoria_aeroporto, empresa_id
FROM public.outra_tarifa WHERE empresa_id IS NULL;

SELECT 'tarifa_recurso' as tabela, id, tipo, valor_usd, categoria_aeroporto, empresa_id
FROM public.tarifa_recurso WHERE empresa_id IS NULL;

-- ==================== PASSO 2: CONTAGEM ====================

SELECT 'tarifa_pouso' as tabela,
       COUNT(*) FILTER (WHERE empresa_id IS NULL) as sem_empresa,
       COUNT(*) FILTER (WHERE empresa_id IS NOT NULL) as com_empresa,
       COUNT(*) as total
FROM public.tarifa_pouso
UNION ALL
SELECT 'tarifa_permanencia',
       COUNT(*) FILTER (WHERE empresa_id IS NULL),
       COUNT(*) FILTER (WHERE empresa_id IS NOT NULL),
       COUNT(*)
FROM public.tarifa_permanencia
UNION ALL
SELECT 'outra_tarifa',
       COUNT(*) FILTER (WHERE empresa_id IS NULL),
       COUNT(*) FILTER (WHERE empresa_id IS NOT NULL),
       COUNT(*)
FROM public.outra_tarifa
UNION ALL
SELECT 'tarifa_recurso',
       COUNT(*) FILTER (WHERE empresa_id IS NULL),
       COUNT(*) FILTER (WHERE empresa_id IS NOT NULL),
       COUNT(*)
FROM public.tarifa_recurso;

-- ==================== PASSO 3: LIMPEZA (DELETE) ====================
-- Só execute depois de confirmar no PASSO 1/2

DELETE FROM public.tarifa_pouso WHERE empresa_id IS NULL;
DELETE FROM public.tarifa_permanencia WHERE empresa_id IS NULL;
DELETE FROM public.outra_tarifa WHERE empresa_id IS NULL;
DELETE FROM public.tarifa_recurso WHERE empresa_id IS NULL;
