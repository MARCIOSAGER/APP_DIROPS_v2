-- Limpeza do curso GED único ANTIGO ("Como usar o Portal de Documentos (GED)")
-- Foi dividido em 3 cursos por função (Consultar/Aprovar/Gerir) + 3 trilhas em 2026-10-03.
-- O curso antigo ficou soft-deleted (invisível no portal), mas as tabelas-filhas do LMS
-- (aula/modulo/pergunta/quiz/matricula) NAO tem coluna deleted_at, logo ficaram orfaos.
-- Este script apaga a fundo esse subarbore + a inscricao de teste do dono (sem certificado).
-- Transaccional: se algo falhar, reverte tudo. Idempotente (se ja estiver limpo, nao faz nada).
--
-- Correr no servidor (a partir de C:\dirops\sga-onpremise):
--   .\scripts\psql.ps1 -f C:\dirops\APP_DIROPS_v2\tools\curso-ged\limpar-curso-antigo.sql
-- (ou)  node scripts\sql.mjs -f C:\dirops\APP_DIROPS_v2\tools\curso-ged\limpar-curso-antigo.sql

\set OID '6a02ecf3-d2d0-49ce-8a33-75d9af3236ef'

BEGIN;

-- 1) progresso / tentativas / certificados ligados a(s) inscricao(oes) no curso antigo
DELETE FROM aula_atividade   WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM progresso_aula   WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM scorm_estado     WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM tentativa        WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM sessao_inscricao WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM certificado      WHERE matricula_id IN (SELECT id FROM matricula WHERE curso_id = :'OID');
DELETE FROM matricula        WHERE curso_id = :'OID';

-- 2) quiz + banco de perguntas
DELETE FROM quiz_item WHERE quiz_id     IN (SELECT id FROM quiz     WHERE curso_id = :'OID')
                         OR pergunta_id IN (SELECT id FROM pergunta WHERE curso_id = :'OID');
DELETE FROM tentativa WHERE quiz_id     IN (SELECT id FROM quiz     WHERE curso_id = :'OID');
DELETE FROM quiz      WHERE curso_id = :'OID';
DELETE FROM pergunta  WHERE curso_id = :'OID';

-- 3) aulas e seus filhos, depois modulos
DELETE FROM aula_atividade  WHERE aula_id IN (SELECT id FROM aula WHERE curso_id = :'OID');
DELETE FROM aula_comentario WHERE aula_id IN (SELECT id FROM aula WHERE curso_id = :'OID');
DELETE FROM progresso_aula  WHERE aula_id IN (SELECT id FROM aula WHERE curso_id = :'OID');
DELETE FROM scorm_estado    WHERE aula_id IN (SELECT id FROM aula WHERE curso_id = :'OID');
DELETE FROM sessao_formacao WHERE aula_id IN (SELECT id FROM aula WHERE curso_id = :'OID');
DELETE FROM aula    WHERE curso_id = :'OID';
DELETE FROM modulo  WHERE curso_id = :'OID';

-- 4) o curso
DELETE FROM curso WHERE id = :'OID';

COMMIT;

-- conferir: deve dar 0 em tudo
SELECT 'curso'    AS tabela, count(*) AS restam FROM curso    WHERE id = :'OID'
UNION ALL SELECT 'aula',     count(*) FROM aula     WHERE curso_id = :'OID'
UNION ALL SELECT 'modulo',   count(*) FROM modulo   WHERE curso_id = :'OID'
UNION ALL SELECT 'pergunta', count(*) FROM pergunta WHERE curso_id = :'OID'
UNION ALL SELECT 'quiz',     count(*) FROM quiz     WHERE curso_id = :'OID'
UNION ALL SELECT 'matricula',count(*) FROM matricula WHERE curso_id = :'OID';
