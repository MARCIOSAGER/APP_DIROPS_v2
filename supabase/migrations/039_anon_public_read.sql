-- MIGRATION 039: Allow anon role to read empresa and aeroporto for public forms
-- Required by CredenciamentoPublico page (unauthenticated users need to select empresa/aeroporto)

-- empresa: anon can read active companies (nome, id, status only needed)
DROP POLICY IF EXISTS "anon_select_empresa" ON public.empresa;
CREATE POLICY "anon_select_empresa" ON public.empresa
  FOR SELECT TO anon
  USING (status = 'ativa');

-- aeroporto: anon can read airports in Angola
DROP POLICY IF EXISTS "anon_select_aeroporto" ON public.aeroporto;
CREATE POLICY "anon_select_aeroporto" ON public.aeroporto
  FOR SELECT TO anon
  USING (true);
