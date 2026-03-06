-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('uploads', 'uploads', true),
  ('private-uploads', 'private-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on uploads bucket
CREATE POLICY "Public read uploads" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- Allow authenticated users to upload
CREATE POLICY "Auth users upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('uploads', 'private-uploads')
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to update their uploads
CREATE POLICY "Auth users update uploads" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('uploads', 'private-uploads')
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their uploads
CREATE POLICY "Auth users delete uploads" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('uploads', 'private-uploads')
    AND auth.role() = 'authenticated'
  );

-- =====================================================
-- DISABLE RLS ON ALL TABLES (for development)
-- Enable later with proper policies for production
-- =====================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE regra_permissao DISABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacao_acesso DISABLE ROW LEVEL SECURITY;
ALTER TABLE empresa DISABLE ROW LEVEL SECURITY;
ALTER TABLE aeroporto DISABLE ROW LEVEL SECURITY;
ALTER TABLE companhia_aerea DISABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_aeronave DISABLE ROW LEVEL SECURITY;
ALTER TABLE registo_aeronave DISABLE ROW LEVEL SECURITY;
ALTER TABLE voo DISABLE ROW LEVEL SECURITY;
ALTER TABLE voo_ligado DISABLE ROW LEVEL SECURITY;
ALTER TABLE cache_voo_f_r24 DISABLE ROW LEVEL SECURITY;
ALTER TABLE tarifa_pouso DISABLE ROW LEVEL SECURITY;
ALTER TABLE tarifa_permanencia DISABLE ROW LEVEL SECURITY;
ALTER TABLE outra_tarifa DISABLE ROW LEVEL SECURITY;
ALTER TABLE imposto DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE calculo_tarifa DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimento_financeiro DISABLE ROW LEVEL SECURITY;
ALTER TABLE proforma DISABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencia_safety DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_inspecao DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_checklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspecao DISABLE ROW LEVEL SECURITY;
ALTER TABLE resposta_inspecao DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE processo_auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE resposta_auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE plano_acao_corretiva DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_p_a_c DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_k_p_i DISABLE ROW LEVEL SECURITY;
ALTER TABLE campo_k_p_i DISABLE ROW LEVEL SECURITY;
ALTER TABLE medicao_k_p_i DISABLE ROW LEVEL SECURITY;
ALTER TABLE valor_campo_k_p_i DISABLE ROW LEVEL SECURITY;
ALTER TABLE reclamacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE historico_reclamacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_area DISABLE ROW LEVEL SECURITY;
ALTER TABLE area_acesso DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_documento DISABLE ROW LEVEL SECURITY;
ALTER TABLE credenciamento DISABLE ROW LEVEL SECURITY;
ALTER TABLE pasta DISABLE ROW LEVEL SECURITY;
ALTER TABLE documento DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_acesso_documento DISABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_servico DISABLE ROW LEVEL SECURITY;
ALTER TABLE registo_g_r_f DISABLE ROW LEVEL SECURITY;
ALTER TABLE regra_notificacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_opt_in_z_a_p_i DISABLE ROW LEVEL SECURITY;
ALTER TABLE historico_notificacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE grupo_whats_app DISABLE ROW LEVEL SECURITY;
ALTER TABLE placeholder DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_auditoria DISABLE ROW LEVEL SECURITY;
