-- Copia uma conta do login da Universidade (auth_uc) para o login do Portal de Documentos (auth_docs), com o mesmo
-- id e a mesma senha. Para quem tem acesso ao GED mas nunca teve conta no DIROPS (o clone da activação só copia do
-- DIROPS). Depois do primeiro login cada senha é independente. Uso:
--   psql -v email=pessoa@sga.co.ao -f clonar-conta-uc-para-gd.sql
SET client_min_messages = notice;
BEGIN;
CREATE TEMP TABLE _alvo ON COMMIT DROP AS SELECT lower(:'email') AS email;
DO $$
DECLARE v_id uuid; v_cols text; v_sel text; v_cols_i text; v_email text;
BEGIN
  SELECT email INTO v_email FROM _alvo;
  EXECUTE 'SELECT id FROM auth_uc.users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1' INTO v_id USING v_email;
  IF v_id IS NULL THEN RAISE EXCEPTION 'sem conta na Universidade: %', v_email; END IF;
  IF EXISTS (SELECT 1 FROM auth_docs.users WHERE id = v_id OR lower(email) = v_email) THEN RAISE NOTICE 'já tem conta no GED: %', v_email; RETURN; END IF;
  SELECT string_agg(quote_ident(a.column_name), ', ' ORDER BY a.ordinal_position),
         string_agg(CASE WHEN a.column_name = 'last_sign_in_at' THEN 'NULL::timestamptz' ELSE quote_ident(a.column_name) END, ', ' ORDER BY a.ordinal_position)
    INTO v_cols, v_sel
    FROM information_schema.columns a
    JOIN information_schema.columns b ON b.table_schema = 'auth_docs' AND b.table_name = a.table_name AND b.column_name = a.column_name
   WHERE a.table_schema = 'auth_uc' AND a.table_name = 'users' AND a.is_generated = 'NEVER' AND b.is_generated = 'NEVER';
  EXECUTE format('INSERT INTO auth_docs.users (%s) SELECT %s FROM auth_uc.users WHERE id = $1', v_cols, v_sel) USING v_id;
  SELECT string_agg(quote_ident(a.column_name), ', ' ORDER BY a.ordinal_position) INTO v_cols_i
    FROM information_schema.columns a
    JOIN information_schema.columns b ON b.table_schema = 'auth_docs' AND b.table_name = a.table_name AND b.column_name = a.column_name
   WHERE a.table_schema = 'auth_uc' AND a.table_name = 'identities' AND a.is_generated = 'NEVER' AND b.is_generated = 'NEVER';
  EXECUTE format('INSERT INTO auth_docs.identities (%s) SELECT %s FROM auth_uc.identities WHERE user_id = $1 ON CONFLICT DO NOTHING', v_cols_i, v_cols_i) USING v_id;
  RAISE NOTICE 'conta copiada da Universidade para o GED: % (%)', v_email, v_id;
END $$;
COMMIT;
SELECT u.email, (u.encrypted_password = c.encrypted_password) AS mesma_senha_da_uc, (SELECT count(*) FROM auth_docs.identities i WHERE i.user_id = u.id) AS identidades
  FROM auth_docs.users u JOIN auth_uc.users c ON c.id = u.id WHERE lower(u.email) = lower(:'email');
