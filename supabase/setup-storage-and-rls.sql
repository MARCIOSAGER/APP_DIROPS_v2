-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('uploads', 'uploads', true),
  ('private-uploads', 'private-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on uploads bucket
-- NOTA (auditoria seguranca 2026, F-12): o bucket 'uploads' e PUBLICO. Item
-- diferido (intranet). Conteudo sensivel deve ir para 'private-uploads' e ser
-- servido por URL assinada. Ver docs/security-audit.
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
-- RLS DAS TABELAS  —  bloco REMOVIDO (auditoria seguranca 2026, F-17)
-- =====================================================
-- Este ficheiro tinha aqui um bloco "DISABLE RLS ON ALL TABLES (for development)"
-- que DESLIGAVA o RLS em ~50 tabelas. Re-executa-lo abriria todo o acesso.
--
-- O RLS de producao (isolamento por empresa + is_admin/is_superadmin) esta em:
--     supabase/rls-hardened-current.sql   <-- usar este para DR/reinstalacao
-- (fonte da verdade gerada da BD real; idempotente; inclui helpers e ~299 politicas).
