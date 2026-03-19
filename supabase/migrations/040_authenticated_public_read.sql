-- MIGRATION 040: Allow authenticated role to read empresa and aeroporto
-- Required by SolicitacaoPerfil page (authenticated users without profile need to select empresa/aeroporto)

-- empresa: authenticated users can read active companies
DROP POLICY IF EXISTS "authenticated_select_empresa" ON public.empresa;
CREATE POLICY "authenticated_select_empresa" ON public.empresa
  FOR SELECT TO authenticated
  USING (status = 'ativa');

-- aeroporto: authenticated users can read all airports
DROP POLICY IF EXISTS "authenticated_select_aeroporto" ON public.aeroporto;
CREATE POLICY "authenticated_select_aeroporto" ON public.aeroporto
  FOR SELECT TO authenticated
  USING (true);
