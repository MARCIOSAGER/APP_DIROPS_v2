-- ============================================================================
-- Teste do controlo de acesso do Portal de Documentos (migrações 136a/136b/136c).
-- Simula utilizadores reais (claims de JWT + role authenticated) e compara o que a base deixa ver/escrever com o
-- esperado. Corre tudo numa transacção revertida: NÃO altera dados. Correr com:
--   powershell -ExecutionPolicy Bypass -File <scratchpad>\psql.ps1 -File scripts\documentos\teste-acesso-documentos.sql
-- Linhas OK = conforme; linhas FALHA = regra violada.
-- ============================================================================
\pset format unaligned
\pset tuples_only on
BEGIN;

CREATE TEMP TABLE t_users (papel text, email text, auth_id uuid);
-- leitor do aeroporto que tem os documentos (hoje FNMO)
INSERT INTO t_users SELECT 'leitor_fnmo', email, auth_id FROM public.users
 WHERE status = 'ativo' AND 'FNMO' = ANY(aeroportos_acesso) AND NOT (role IN ('admin', 'superadmin') OR 'administrador' = ANY(perfis))
   AND NOT (perfis && ARRAY['gestor_documentos', 'admin_documentos']) ORDER BY email LIMIT 1;
-- leitor de outro aeroporto
INSERT INTO t_users SELECT 'leitor_outro', email, auth_id FROM public.users
 WHERE status = 'ativo' AND NOT ('FNMO' = ANY(coalesce(aeroportos_acesso, '{}'))) AND cardinality(aeroportos_acesso) >= 1
   AND NOT (role IN ('admin', 'superadmin') OR 'administrador' = ANY(perfis)) AND NOT (perfis && ARRAY['gestor_documentos', 'admin_documentos']) ORDER BY email LIMIT 1;
-- gestor (responsável de aeroporto) e administrador
INSERT INTO t_users SELECT 'gestor', email, auth_id FROM public.users WHERE status = 'ativo' AND 'gestor_documentos' = ANY(perfis) AND NOT ('admin_documentos' = ANY(perfis)) ORDER BY email LIMIT 1;
INSERT INTO t_users SELECT 'admin', email, auth_id FROM public.users WHERE status = 'ativo' AND 'admin_documentos' = ANY(perfis) ORDER BY email LIMIT 1;
GRANT SELECT ON t_users TO authenticated, anon;

CREATE TEMP TABLE r (papel text, chave text, obtido text, esperado text);
GRANT SELECT, INSERT ON r TO authenticated, anon;

-- esperado por utilizador: pastas e documentos dos seus aeroportos (herança sem permissões explícitas)
CREATE TEMP TABLE v_esperado AS
SELECT t.papel,
       (SELECT count(*) FROM public.pasta p WHERE p.deleted_at IS NULL
          AND (p.aeroporto_id IS NULL OR p.aeroporto_id IN (SELECT aeroporto_id FROM public.documentos_acesso_aeroporto a WHERE a.email = lower(t.email)
                                                            UNION SELECT aeroporto_id FROM public.documentos_aeroporto_responsavel x WHERE x.email = lower(t.email)))) AS pastas,
       (SELECT count(*) FROM public.documento d LEFT JOIN public.pasta p ON p.id = d.pasta_id
         WHERE d.voo_ligado_id IS NULL AND d.deleted_at IS NULL AND coalesce(d.estado, 'em_vigor') = 'em_vigor'
           AND (coalesce(p.aeroporto_id, d.aeroporto_id) IS NULL
                OR coalesce(p.aeroporto_id, d.aeroporto_id) IN (SELECT aeroporto_id FROM public.documentos_acesso_aeroporto a WHERE a.email = lower(t.email)
                                                                UNION SELECT aeroporto_id FROM public.documentos_aeroporto_responsavel x WHERE x.email = lower(t.email)))) AS docs
  FROM t_users t;
GRANT SELECT ON v_esperado TO authenticated, anon;

-- ── leitor do aeroporto dos documentos ──
SELECT set_config('request.jwt.claims', (SELECT json_build_object('sub', auth_id, 'email', email, 'role', 'authenticated')::text FROM t_users WHERE papel = 'leitor_fnmo'), true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'leitor_fnmo', 'pastas', (SELECT count(*)::text FROM public.pasta), (SELECT pastas::text FROM v_esperado WHERE papel = 'leitor_fnmo');
INSERT INTO r SELECT 'leitor_fnmo', 'documentos', (SELECT count(*)::text FROM public.documento), (SELECT docs::text FROM v_esperado WHERE papel = 'leitor_fnmo');
INSERT INTO r SELECT 'leitor_fnmo', 'pode_editar_um', (SELECT public.pode_editar_documento(id)::text FROM public.documento LIMIT 1), 'false';
INSERT INTO r SELECT 'leitor_fnmo', 'nivel', public.doc_membro()::text || '/' || public.doc_editor()::text || '/' || public.doc_gestor()::text, 'true/false/false';
RESET ROLE;
-- ── leitor de outro aeroporto: não vê nada do FNMO ──
SELECT set_config('request.jwt.claims', (SELECT json_build_object('sub', auth_id, 'email', email, 'role', 'authenticated')::text FROM t_users WHERE papel = 'leitor_outro'), true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'leitor_outro', 'pastas', (SELECT count(*)::text FROM public.pasta), (SELECT pastas::text FROM v_esperado WHERE papel = 'leitor_outro');
INSERT INTO r SELECT 'leitor_outro', 'documentos', (SELECT count(*)::text FROM public.documento), (SELECT docs::text FROM v_esperado WHERE papel = 'leitor_outro');
RESET ROLE;
-- ── gestor ──
SELECT set_config('request.jwt.claims', (SELECT json_build_object('sub', auth_id, 'email', email, 'role', 'authenticated')::text FROM t_users WHERE papel = 'gestor'), true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'gestor', 'nivel', public.doc_membro()::text || '/' || public.doc_editor()::text || '/' || public.doc_gestor()::text || '/' || public.doc_admin()::text, 'true/true/true/false';
INSERT INTO r SELECT 'gestor', 'pastas', (SELECT count(*)::text FROM public.pasta), (SELECT pastas::text FROM v_esperado WHERE papel = 'gestor');
RESET ROLE;
-- ── administrador: vê tudo ──
SELECT set_config('request.jwt.claims', (SELECT json_build_object('sub', auth_id, 'email', email, 'role', 'authenticated')::text FROM t_users WHERE papel = 'admin'), true);
SET LOCAL ROLE authenticated;
INSERT INTO r SELECT 'admin', 'pastas', (SELECT count(*)::text FROM public.pasta), (SELECT count(*)::text FROM public.pasta);
INSERT INTO r SELECT 'admin', 'documentos', (SELECT count(*)::text FROM public.documento), (SELECT count(*)::text FROM public.documento);
RESET ROLE;
-- ── sem sessão ──
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
INSERT INTO r SELECT 'anon', 'documentos', (SELECT count(*)::text FROM public.documento), '0';
INSERT INTO r SELECT 'anon', 'pastas', (SELECT count(*)::text FROM public.pasta), '0';
INSERT INTO r SELECT 'anon', 'links', (SELECT count(*)::text FROM public.documento_link_partilha), '0';
RESET ROLE;

SELECT CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'OK   ' ELSE 'FALHA' END || ' ' || papel || ' ' || chave || ' = ' || coalesce(obtido, 'null') || ' (esperado ' || coalesce(esperado, 'null') || ')' FROM r ORDER BY papel, chave;
SELECT 'RESUMO ' || count(*) FILTER (WHERE obtido IS NOT DISTINCT FROM esperado) || '/' || count(*) || ' conformes' FROM r;
ROLLBACK;
