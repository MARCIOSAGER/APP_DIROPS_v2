-- Drop and recreate policies for users table
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- Allow authenticated users to read/write all operational tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'regra_permissao', 'aeroporto', 'companhia_aerea', 'modelo_aeronave',
      'configuracao_sistema', 'tarifa_pouso', 'tarifa_permanencia', 'outra_tarifa',
      'imposto', 'tipo_inspecao', 'tipo_auditoria', 'tipo_k_p_i', 'tipo_documento',
      'regra_notificacao', 'grupo_whats_app', 'item_checklist', 'item_auditoria',
      'campo_k_p_i', 'configuracao_area', 'area_acesso', 'placeholder',
      'registo_aeronave', 'voo', 'voo_ligado', 'calculo_tarifa', 'proforma',
      'inspecao', 'resposta_inspecao', 'processo_auditoria', 'resposta_auditoria',
      'credenciamento', 'documento', 'ordem_servico', 'registo_g_r_f',
      'solicitacao_acesso', 'ocorrencia_safety', 'reclamacao', 'medicao_k_p_i',
      'movimento_financeiro', 'plano_acao_corretiva', 'log_auditoria',
      'historico_reclamacao', 'historico_notificacao', 'configuracao_notificacoes',
      'configuracao_opt_in_z_a_p_i', 'valor_campo_k_p_i', 'item_p_a_c',
      'cache_voo_f_r24', 'log_acesso_documento', 'pasta'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read access" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated read access" ON %I FOR SELECT TO authenticated USING (true)', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated write access" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated write access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl
    );
  END LOOP;
END $$;
