-- ============================================================================
-- rls-hardened-current.sql
-- ESTADO REAL do RLS de producao (gerado da BD on-premise, 2026-08-29).
-- Fonte da verdade para recuperacao/DR. SUBSTITUI o antigo fix-rls-policies.sql
-- e o bloco 'DISABLE RLS' do setup-storage-and-rls.sql (que reabririam tudo).
-- Re-executavel (idempotente). Depende so de si proprio (inclui os helpers).
-- ============================================================================

-- === Funcoes auxiliares + trigger anti-escalacao (as politicas dependem delas) ===
CREATE OR REPLACE FUNCTION public.current_user_empresa_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT empresa_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND (role = 'admin' OR 'administrador' = ANY(perfis))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND empresa_id IS NULL
      AND (role = 'admin' OR 'administrador' = ANY(perfis))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- If user is updating their own row, prevent changes to sensitive fields
  IF NEW.auth_id = auth.uid() THEN
    NEW.role := OLD.role;
    NEW.perfis := OLD.perfis;
    NEW.empresa_id := OLD.empresa_id;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_prevent_self_escalation ON public.users;
CREATE TRIGGER trg_prevent_self_escalation BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION prevent_self_escalation();

-- === ENABLE ROW LEVEL SECURITY ===
ALTER TABLE public.aeroporto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_voo_f_r24 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculo_tarifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campo_k_p_i ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companhia_aerea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_notificacao_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_opt_in_z_a_p_i ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credenciamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacao_trafego_pp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_whats_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_reclamacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imposto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_p_a_c ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenca_conducao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_acesso_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicao_k_p_i ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_aeronave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimento_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_safety ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outra_tarifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pasta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placeholder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acao_corretiva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_contador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurso_voo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registo_aeronave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registo_g_r_f ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regra_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regra_permissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_destinatario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resposta_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resposta_inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_voo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifa_permanencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifa_pouso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifa_recurso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxa_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_suporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_k_p_i ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_outra_tarifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_servico_geral ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valor_campo_k_p_i ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voo_ligado ENABLE ROW LEVEL SECURITY;

-- === Politicas RLS (estado atual endurecido) ===
DROP POLICY IF EXISTS empresa_delete_aeroporto ON public.aeroporto;
CREATE POLICY empresa_delete_aeroporto ON public.aeroporto AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_aeroporto ON public.aeroporto;
CREATE POLICY empresa_insert_aeroporto ON public.aeroporto AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS anon_select_aeroporto ON public.aeroporto;
CREATE POLICY anon_select_aeroporto ON public.aeroporto AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS authenticated_select_aeroporto ON public.aeroporto;
CREATE POLICY authenticated_select_aeroporto ON public.aeroporto AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_select_aeroporto ON public.aeroporto;
CREATE POLICY empresa_select_aeroporto ON public.aeroporto AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_aeroporto ON public.aeroporto;
CREATE POLICY empresa_update_aeroporto ON public.aeroporto AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS api_log_service ON public.api_access_log;
CREATE POLICY api_log_service ON public.api_access_log AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS api_log_insert ON public.api_access_log;
CREATE POLICY api_log_insert ON public.api_access_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS api_log_select ON public.api_access_log;
CREATE POLICY api_log_select ON public.api_access_log AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS api_key_service ON public.api_key;
CREATE POLICY api_key_service ON public.api_key AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS api_key_delete ON public.api_key;
CREATE POLICY api_key_delete ON public.api_key AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS api_key_insert ON public.api_key;
CREATE POLICY api_key_insert ON public.api_key AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS api_key_select ON public.api_key;
CREATE POLICY api_key_select ON public.api_key AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS api_key_update ON public.api_key;
CREATE POLICY api_key_update ON public.api_key AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id())))) WITH CHECK ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS api_rate_service ON public.api_rate_limit;
CREATE POLICY api_rate_service ON public.api_rate_limit AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_delete_area_acesso ON public.area_acesso;
CREATE POLICY config_delete_area_acesso ON public.area_acesso AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_area_acesso ON public.area_acesso;
CREATE POLICY config_insert_area_acesso ON public.area_acesso AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_area_acesso ON public.area_acesso;
CREATE POLICY config_select_area_acesso ON public.area_acesso AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_area_acesso ON public.area_acesso;
CREATE POLICY config_update_area_acesso ON public.area_acesso AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS cache_delete ON public.cache_voo_f_r24;
CREATE POLICY cache_delete ON public.cache_voo_f_r24 AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS cache_insert ON public.cache_voo_f_r24;
CREATE POLICY cache_insert ON public.cache_voo_f_r24 AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cache_select ON public.cache_voo_f_r24;
CREATE POLICY cache_select ON public.cache_voo_f_r24 AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cache_update ON public.cache_voo_f_r24;
CREATE POLICY cache_update ON public.cache_voo_f_r24 AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS empresa_delete_calculo_tarifa ON public.calculo_tarifa;
CREATE POLICY empresa_delete_calculo_tarifa ON public.calculo_tarifa AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_calculo_tarifa ON public.calculo_tarifa;
CREATE POLICY empresa_insert_calculo_tarifa ON public.calculo_tarifa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_calculo_tarifa ON public.calculo_tarifa;
CREATE POLICY empresa_select_calculo_tarifa ON public.calculo_tarifa AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_calculo_tarifa ON public.calculo_tarifa;
CREATE POLICY empresa_update_calculo_tarifa ON public.calculo_tarifa AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS config_delete_campo_k_p_i ON public.campo_k_p_i;
CREATE POLICY config_delete_campo_k_p_i ON public.campo_k_p_i AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_campo_k_p_i ON public.campo_k_p_i;
CREATE POLICY config_insert_campo_k_p_i ON public.campo_k_p_i AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_campo_k_p_i ON public.campo_k_p_i;
CREATE POLICY config_select_campo_k_p_i ON public.campo_k_p_i AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_campo_k_p_i ON public.campo_k_p_i;
CREATE POLICY config_update_campo_k_p_i ON public.campo_k_p_i AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_delete_cliente ON public.cliente;
CREATE POLICY admin_delete_cliente ON public.cliente AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS open_insert_cliente ON public.cliente;
CREATE POLICY open_insert_cliente ON public.cliente AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS open_select_cliente ON public.cliente;
CREATE POLICY open_select_cliente ON public.cliente AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS open_update_cliente ON public.cliente;
CREATE POLICY open_update_cliente ON public.cliente AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS empresa_delete_cobranca_servico ON public.cobranca_servico;
CREATE POLICY empresa_delete_cobranca_servico ON public.cobranca_servico AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_cobranca_servico ON public.cobranca_servico;
CREATE POLICY empresa_insert_cobranca_servico ON public.cobranca_servico AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_cobranca_servico ON public.cobranca_servico;
CREATE POLICY empresa_select_cobranca_servico ON public.cobranca_servico AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_cobranca_servico ON public.cobranca_servico;
CREATE POLICY empresa_update_cobranca_servico ON public.cobranca_servico AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS config_delete_companhia_aerea ON public.companhia_aerea;
CREATE POLICY config_delete_companhia_aerea ON public.companhia_aerea AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_companhia_aerea ON public.companhia_aerea;
CREATE POLICY config_insert_companhia_aerea ON public.companhia_aerea AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS anon_select_companhia_aerea ON public.companhia_aerea;
CREATE POLICY anon_select_companhia_aerea ON public.companhia_aerea AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS config_select_companhia_aerea ON public.companhia_aerea;
CREATE POLICY config_select_companhia_aerea ON public.companhia_aerea AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_companhia_aerea ON public.companhia_aerea;
CREATE POLICY config_update_companhia_aerea ON public.companhia_aerea AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_config_notificacao_manutencao ON public.config_notificacao_manutencao;
CREATE POLICY authenticated_delete_config_notificacao_manutencao ON public.config_notificacao_manutencao AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_config_notificacao_manutencao ON public.config_notificacao_manutencao;
CREATE POLICY authenticated_insert_config_notificacao_manutencao ON public.config_notificacao_manutencao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_config_notificacao_manutencao ON public.config_notificacao_manutencao;
CREATE POLICY authenticated_select_config_notificacao_manutencao ON public.config_notificacao_manutencao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_config_notificacao_manutencao ON public.config_notificacao_manutencao;
CREATE POLICY authenticated_update_config_notificacao_manutencao ON public.config_notificacao_manutencao AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_delete_configuracao_area ON public.configuracao_area;
CREATE POLICY config_delete_configuracao_area ON public.configuracao_area AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_configuracao_area ON public.configuracao_area;
CREATE POLICY config_insert_configuracao_area ON public.configuracao_area AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_configuracao_area ON public.configuracao_area;
CREATE POLICY config_select_configuracao_area ON public.configuracao_area AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_configuracao_area ON public.configuracao_area;
CREATE POLICY config_update_configuracao_area ON public.configuracao_area AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_delete_configuracao_notificacoes ON public.configuracao_notificacoes;
CREATE POLICY config_delete_configuracao_notificacoes ON public.configuracao_notificacoes AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_configuracao_notificacoes ON public.configuracao_notificacoes;
CREATE POLICY config_insert_configuracao_notificacoes ON public.configuracao_notificacoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_configuracao_notificacoes ON public.configuracao_notificacoes;
CREATE POLICY config_select_configuracao_notificacoes ON public.configuracao_notificacoes AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_configuracao_notificacoes ON public.configuracao_notificacoes;
CREATE POLICY config_update_configuracao_notificacoes ON public.configuracao_notificacoes AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS authenticated_delete_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i;
CREATE POLICY authenticated_delete_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i;
CREATE POLICY authenticated_insert_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i;
CREATE POLICY authenticated_select_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i;
CREATE POLICY authenticated_update_configuracao_opt_in_z_a_p_i ON public.configuracao_opt_in_z_a_p_i AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_sistema_delete ON public.configuracao_sistema;
CREATE POLICY config_sistema_delete ON public.configuracao_sistema AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS config_sistema_insert ON public.configuracao_sistema;
CREATE POLICY config_sistema_insert ON public.configuracao_sistema AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS anon_select_configuracao_sistema ON public.configuracao_sistema;
CREATE POLICY anon_select_configuracao_sistema ON public.configuracao_sistema AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS config_sistema_select ON public.configuracao_sistema;
CREATE POLICY config_sistema_select ON public.configuracao_sistema AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_sistema_update ON public.configuracao_sistema;
CREATE POLICY config_sistema_update ON public.configuracao_sistema AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_delete_credenciamento ON public.credenciamento;
CREATE POLICY empresa_delete_credenciamento ON public.credenciamento AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS anon_insert_credenciamento ON public.credenciamento;
CREATE POLICY anon_insert_credenciamento ON public.credenciamento AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS empresa_insert_credenciamento ON public.credenciamento;
CREATE POLICY empresa_insert_credenciamento ON public.credenciamento AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_credenciamento ON public.credenciamento;
CREATE POLICY empresa_select_credenciamento ON public.credenciamento AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_credenciamento ON public.credenciamento;
CREATE POLICY empresa_update_credenciamento ON public.credenciamento AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_documento ON public.documento;
CREATE POLICY empresa_delete_documento ON public.documento AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_documento ON public.documento;
CREATE POLICY empresa_insert_documento ON public.documento AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_documento ON public.documento;
CREATE POLICY empresa_select_documento ON public.documento AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_documento ON public.documento;
CREATE POLICY empresa_update_documento ON public.documento AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete ON public.empresa;
CREATE POLICY empresa_delete ON public.empresa AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS empresa_insert ON public.empresa;
CREATE POLICY empresa_insert ON public.empresa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS anon_select_empresa ON public.empresa;
CREATE POLICY anon_select_empresa ON public.empresa AS PERMISSIVE FOR SELECT TO anon USING ((status = 'ativa'::text));

DROP POLICY IF EXISTS authenticated_select_empresa ON public.empresa;
CREATE POLICY authenticated_select_empresa ON public.empresa AS PERMISSIVE FOR SELECT TO authenticated USING ((status = 'ativa'::text));

DROP POLICY IF EXISTS empresa_select ON public.empresa;
CREATE POLICY empresa_select ON public.empresa AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_update ON public.empresa;
CREATE POLICY empresa_update ON public.empresa AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (id = current_user_empresa_id())));

DROP POLICY IF EXISTS fact_pp_delete ON public.facturacao_trafego_pp;
CREATE POLICY fact_pp_delete ON public.facturacao_trafego_pp AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS fact_pp_insert ON public.facturacao_trafego_pp;
CREATE POLICY fact_pp_insert ON public.facturacao_trafego_pp AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS fact_pp_select ON public.facturacao_trafego_pp;
CREATE POLICY fact_pp_select ON public.facturacao_trafego_pp AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fact_pp_update ON public.facturacao_trafego_pp;
CREATE POLICY fact_pp_update ON public.facturacao_trafego_pp AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS authenticated_delete_grupo_whats_app ON public.grupo_whats_app;
CREATE POLICY authenticated_delete_grupo_whats_app ON public.grupo_whats_app AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_grupo_whats_app ON public.grupo_whats_app;
CREATE POLICY authenticated_insert_grupo_whats_app ON public.grupo_whats_app AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_grupo_whats_app ON public.grupo_whats_app;
CREATE POLICY authenticated_select_grupo_whats_app ON public.grupo_whats_app AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_grupo_whats_app ON public.grupo_whats_app;
CREATE POLICY authenticated_update_grupo_whats_app ON public.grupo_whats_app AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS log_delete_historico_notificacao ON public.historico_notificacao;
CREATE POLICY log_delete_historico_notificacao ON public.historico_notificacao AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS log_insert_historico_notificacao ON public.historico_notificacao;
CREATE POLICY log_insert_historico_notificacao ON public.historico_notificacao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS log_select_historico_notificacao ON public.historico_notificacao;
CREATE POLICY log_select_historico_notificacao ON public.historico_notificacao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS log_update_historico_notificacao ON public.historico_notificacao;
CREATE POLICY log_update_historico_notificacao ON public.historico_notificacao AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS log_delete_historico_reclamacao ON public.historico_reclamacao;
CREATE POLICY log_delete_historico_reclamacao ON public.historico_reclamacao AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS anon_insert_historico_reclamacao ON public.historico_reclamacao;
CREATE POLICY anon_insert_historico_reclamacao ON public.historico_reclamacao AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS log_insert_historico_reclamacao ON public.historico_reclamacao;
CREATE POLICY log_insert_historico_reclamacao ON public.historico_reclamacao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS log_select_historico_reclamacao ON public.historico_reclamacao;
CREATE POLICY log_select_historico_reclamacao ON public.historico_reclamacao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS log_update_historico_reclamacao ON public.historico_reclamacao;
CREATE POLICY log_update_historico_reclamacao ON public.historico_reclamacao AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_delete_imposto ON public.imposto;
CREATE POLICY empresa_delete_imposto ON public.imposto AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_imposto ON public.imposto;
CREATE POLICY empresa_insert_imposto ON public.imposto AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_imposto ON public.imposto;
CREATE POLICY empresa_select_imposto ON public.imposto AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_imposto ON public.imposto;
CREATE POLICY empresa_update_imposto ON public.imposto AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_inspecao ON public.inspecao;
CREATE POLICY empresa_delete_inspecao ON public.inspecao AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_inspecao ON public.inspecao;
CREATE POLICY empresa_insert_inspecao ON public.inspecao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_inspecao ON public.inspecao;
CREATE POLICY empresa_select_inspecao ON public.inspecao AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id IS NULL) OR (empresa_id = current_user_empresa_id())));

DROP POLICY IF EXISTS empresa_update_inspecao ON public.inspecao;
CREATE POLICY empresa_update_inspecao ON public.inspecao AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))));

DROP POLICY IF EXISTS authenticated_delete_item_auditoria ON public.item_auditoria;
CREATE POLICY authenticated_delete_item_auditoria ON public.item_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_item_auditoria ON public.item_auditoria;
CREATE POLICY authenticated_insert_item_auditoria ON public.item_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_item_auditoria ON public.item_auditoria;
CREATE POLICY authenticated_select_item_auditoria ON public.item_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_item_auditoria ON public.item_auditoria;
CREATE POLICY authenticated_update_item_auditoria ON public.item_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_item_checklist ON public.item_checklist;
CREATE POLICY authenticated_delete_item_checklist ON public.item_checklist AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_item_checklist ON public.item_checklist;
CREATE POLICY authenticated_insert_item_checklist ON public.item_checklist AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_item_checklist ON public.item_checklist;
CREATE POLICY authenticated_select_item_checklist ON public.item_checklist AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_item_checklist ON public.item_checklist;
CREATE POLICY authenticated_update_item_checklist ON public.item_checklist AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_item_p_a_c ON public.item_p_a_c;
CREATE POLICY authenticated_delete_item_p_a_c ON public.item_p_a_c AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_item_p_a_c ON public.item_p_a_c;
CREATE POLICY authenticated_insert_item_p_a_c ON public.item_p_a_c AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_item_p_a_c ON public.item_p_a_c;
CREATE POLICY authenticated_select_item_p_a_c ON public.item_p_a_c AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_item_p_a_c ON public.item_p_a_c;
CREATE POLICY authenticated_update_item_p_a_c ON public.item_p_a_c AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_licenca_conducao ON public.licenca_conducao;
CREATE POLICY authenticated_delete_licenca_conducao ON public.licenca_conducao AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_licenca_conducao ON public.licenca_conducao;
CREATE POLICY authenticated_insert_licenca_conducao ON public.licenca_conducao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_licenca_conducao ON public.licenca_conducao;
CREATE POLICY authenticated_select_licenca_conducao ON public.licenca_conducao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_licenca_conducao ON public.licenca_conducao;
CREATE POLICY authenticated_update_licenca_conducao ON public.licenca_conducao AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS log_delete_log_acesso_documento ON public.log_acesso_documento;
CREATE POLICY log_delete_log_acesso_documento ON public.log_acesso_documento AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS log_insert_log_acesso_documento ON public.log_acesso_documento;
CREATE POLICY log_insert_log_acesso_documento ON public.log_acesso_documento AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS log_select_log_acesso_documento ON public.log_acesso_documento;
CREATE POLICY log_select_log_acesso_documento ON public.log_acesso_documento AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS log_update_log_acesso_documento ON public.log_acesso_documento;
CREATE POLICY log_update_log_acesso_documento ON public.log_acesso_documento AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS log_delete_log_auditoria ON public.log_auditoria;
CREATE POLICY log_delete_log_auditoria ON public.log_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS log_insert_log_auditoria ON public.log_auditoria;
CREATE POLICY log_insert_log_auditoria ON public.log_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS log_select_log_auditoria ON public.log_auditoria;
CREATE POLICY log_select_log_auditoria ON public.log_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS log_update_log_auditoria ON public.log_auditoria;
CREATE POLICY log_update_log_auditoria ON public.log_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_delete_medicao_k_p_i ON public.medicao_k_p_i;
CREATE POLICY empresa_delete_medicao_k_p_i ON public.medicao_k_p_i AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_medicao_k_p_i ON public.medicao_k_p_i;
CREATE POLICY empresa_insert_medicao_k_p_i ON public.medicao_k_p_i AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_medicao_k_p_i ON public.medicao_k_p_i;
CREATE POLICY empresa_select_medicao_k_p_i ON public.medicao_k_p_i AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_medicao_k_p_i ON public.medicao_k_p_i;
CREATE POLICY empresa_update_medicao_k_p_i ON public.medicao_k_p_i AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS config_delete_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY config_delete_modelo_aeronave ON public.modelo_aeronave AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY config_insert_modelo_aeronave ON public.modelo_aeronave AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS config_select_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY config_select_modelo_aeronave ON public.modelo_aeronave AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY config_update_modelo_aeronave ON public.modelo_aeronave AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS log_delete_movimento_financeiro ON public.movimento_financeiro;
CREATE POLICY log_delete_movimento_financeiro ON public.movimento_financeiro AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = movimento_financeiro.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL))))))));

DROP POLICY IF EXISTS log_insert_movimento_financeiro ON public.movimento_financeiro;
CREATE POLICY log_insert_movimento_financeiro ON public.movimento_financeiro AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (is_admin() AND (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = movimento_financeiro.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL))))))));

DROP POLICY IF EXISTS log_select_movimento_financeiro ON public.movimento_financeiro;
CREATE POLICY log_select_movimento_financeiro ON public.movimento_financeiro AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = movimento_financeiro.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL)))))));

DROP POLICY IF EXISTS log_update_movimento_financeiro ON public.movimento_financeiro;
CREATE POLICY log_update_movimento_financeiro ON public.movimento_financeiro AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (is_admin() AND (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = movimento_financeiro.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL)))))))) WITH CHECK ((is_superadmin() OR (is_admin() AND (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = movimento_financeiro.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL))))))));

DROP POLICY IF EXISTS empresa_delete_ocorrencia_safety ON public.ocorrencia_safety;
CREATE POLICY empresa_delete_ocorrencia_safety ON public.ocorrencia_safety AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_ocorrencia_safety ON public.ocorrencia_safety;
CREATE POLICY empresa_insert_ocorrencia_safety ON public.ocorrencia_safety AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_ocorrencia_safety ON public.ocorrencia_safety;
CREATE POLICY empresa_select_ocorrencia_safety ON public.ocorrencia_safety AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_ocorrencia_safety ON public.ocorrencia_safety;
CREATE POLICY empresa_update_ocorrencia_safety ON public.ocorrencia_safety AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_ordem_servico ON public.ordem_servico;
CREATE POLICY empresa_delete_ordem_servico ON public.ordem_servico AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_ordem_servico ON public.ordem_servico;
CREATE POLICY empresa_insert_ordem_servico ON public.ordem_servico AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_ordem_servico ON public.ordem_servico;
CREATE POLICY empresa_select_ordem_servico ON public.ordem_servico AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_ordem_servico ON public.ordem_servico;
CREATE POLICY empresa_update_ordem_servico ON public.ordem_servico AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_outra_tarifa ON public.outra_tarifa;
CREATE POLICY empresa_delete_outra_tarifa ON public.outra_tarifa AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_outra_tarifa ON public.outra_tarifa;
CREATE POLICY empresa_insert_outra_tarifa ON public.outra_tarifa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_outra_tarifa ON public.outra_tarifa;
CREATE POLICY empresa_select_outra_tarifa ON public.outra_tarifa AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_outra_tarifa ON public.outra_tarifa;
CREATE POLICY empresa_update_outra_tarifa ON public.outra_tarifa AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS pasta_delete ON public.pasta;
CREATE POLICY pasta_delete ON public.pasta AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS pasta_insert ON public.pasta;
CREATE POLICY pasta_insert ON public.pasta AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS pasta_select ON public.pasta;
CREATE POLICY pasta_select ON public.pasta AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pasta_update ON public.pasta;
CREATE POLICY pasta_update ON public.pasta AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "authenticated can insert performance_log" ON public.performance_log;
CREATE POLICY "authenticated can insert performance_log" ON public.performance_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "superadmin can read performance_log" ON public.performance_log;
CREATE POLICY "superadmin can read performance_log" ON public.performance_log AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = auth.uid()) AND (users.empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_delete_placeholder ON public.placeholder;
CREATE POLICY config_delete_placeholder ON public.placeholder AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_placeholder ON public.placeholder;
CREATE POLICY config_insert_placeholder ON public.placeholder AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_placeholder ON public.placeholder;
CREATE POLICY config_select_placeholder ON public.placeholder AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_placeholder ON public.placeholder;
CREATE POLICY config_update_placeholder ON public.placeholder AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS authenticated_delete_plano_acao_corretiva ON public.plano_acao_corretiva;
CREATE POLICY authenticated_delete_plano_acao_corretiva ON public.plano_acao_corretiva AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = plano_acao_corretiva.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL))))))));

DROP POLICY IF EXISTS authenticated_insert_plano_acao_corretiva ON public.plano_acao_corretiva;
CREATE POLICY authenticated_insert_plano_acao_corretiva ON public.plano_acao_corretiva AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = plano_acao_corretiva.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL)))))));

DROP POLICY IF EXISTS authenticated_select_plano_acao_corretiva ON public.plano_acao_corretiva;
CREATE POLICY authenticated_select_plano_acao_corretiva ON public.plano_acao_corretiva AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = plano_acao_corretiva.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL)))))));

DROP POLICY IF EXISTS authenticated_update_plano_acao_corretiva ON public.plano_acao_corretiva;
CREATE POLICY authenticated_update_plano_acao_corretiva ON public.plano_acao_corretiva AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = plano_acao_corretiva.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL))))))) WITH CHECK ((is_superadmin() OR (EXISTS ( SELECT 1
   FROM aeroporto a
  WHERE ((a.id = plano_acao_corretiva.aeroporto_id) AND ((a.empresa_id = current_user_empresa_id()) OR (a.empresa_id IS NULL)))))));

DROP POLICY IF EXISTS empresa_delete_processo_auditoria ON public.processo_auditoria;
CREATE POLICY empresa_delete_processo_auditoria ON public.processo_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_processo_auditoria ON public.processo_auditoria;
CREATE POLICY empresa_insert_processo_auditoria ON public.processo_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_processo_auditoria ON public.processo_auditoria;
CREATE POLICY empresa_select_processo_auditoria ON public.processo_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_processo_auditoria ON public.processo_auditoria;
CREATE POLICY empresa_update_processo_auditoria ON public.processo_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_proforma ON public.proforma;
CREATE POLICY empresa_delete_proforma ON public.proforma AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_proforma ON public.proforma;
CREATE POLICY empresa_insert_proforma ON public.proforma AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_proforma ON public.proforma;
CREATE POLICY empresa_select_proforma ON public.proforma AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_proforma ON public.proforma;
CREATE POLICY empresa_update_proforma ON public.proforma AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_proforma_item ON public.proforma_item;
CREATE POLICY empresa_delete_proforma_item ON public.proforma_item AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_proforma_item ON public.proforma_item;
CREATE POLICY empresa_insert_proforma_item ON public.proforma_item AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_proforma_item ON public.proforma_item;
CREATE POLICY empresa_select_proforma_item ON public.proforma_item AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_proforma_item ON public.proforma_item;
CREATE POLICY empresa_update_proforma_item ON public.proforma_item AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_reclamacao ON public.reclamacao;
CREATE POLICY empresa_delete_reclamacao ON public.reclamacao AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS anon_insert_reclamacao ON public.reclamacao;
CREATE POLICY anon_insert_reclamacao ON public.reclamacao AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS empresa_insert_reclamacao ON public.reclamacao;
CREATE POLICY empresa_insert_reclamacao ON public.reclamacao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS auth_select_reclamacao ON public.reclamacao;
CREATE POLICY auth_select_reclamacao ON public.reclamacao AS PERMISSIVE FOR SELECT TO authenticated USING (((empresa_id IN ( SELECT users.empresa_id
   FROM users
  WHERE (users.auth_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = auth.uid()) AND (users.empresa_id IS NULL))))));

DROP POLICY IF EXISTS empresa_select_reclamacao ON public.reclamacao;
CREATE POLICY empresa_select_reclamacao ON public.reclamacao AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_reclamacao ON public.reclamacao;
CREATE POLICY empresa_update_reclamacao ON public.reclamacao AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS admin_delete_recurso_voo ON public.recurso_voo;
CREATE POLICY admin_delete_recurso_voo ON public.recurso_voo AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS open_insert_recurso_voo ON public.recurso_voo;
CREATE POLICY open_insert_recurso_voo ON public.recurso_voo AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS open_select_recurso_voo ON public.recurso_voo;
CREATE POLICY open_select_recurso_voo ON public.recurso_voo AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS open_update_recurso_voo ON public.recurso_voo;
CREATE POLICY open_update_recurso_voo ON public.recurso_voo AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_delete_registo_aeronave ON public.registo_aeronave;
CREATE POLICY config_delete_registo_aeronave ON public.registo_aeronave AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_registo_aeronave ON public.registo_aeronave;
CREATE POLICY config_insert_registo_aeronave ON public.registo_aeronave AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS config_select_registo_aeronave ON public.registo_aeronave;
CREATE POLICY config_select_registo_aeronave ON public.registo_aeronave AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_registo_aeronave ON public.registo_aeronave;
CREATE POLICY config_update_registo_aeronave ON public.registo_aeronave AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_registo_g_r_f ON public.registo_g_r_f;
CREATE POLICY authenticated_delete_registo_g_r_f ON public.registo_g_r_f AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_registo_g_r_f ON public.registo_g_r_f;
CREATE POLICY authenticated_insert_registo_g_r_f ON public.registo_g_r_f AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_registo_g_r_f ON public.registo_g_r_f;
CREATE POLICY authenticated_select_registo_g_r_f ON public.registo_g_r_f AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_registo_g_r_f ON public.registo_g_r_f;
CREATE POLICY authenticated_update_registo_g_r_f ON public.registo_g_r_f AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_delete_regra_notificacao ON public.regra_notificacao;
CREATE POLICY config_delete_regra_notificacao ON public.regra_notificacao AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_regra_notificacao ON public.regra_notificacao;
CREATE POLICY config_insert_regra_notificacao ON public.regra_notificacao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_regra_notificacao ON public.regra_notificacao;
CREATE POLICY config_select_regra_notificacao ON public.regra_notificacao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_regra_notificacao ON public.regra_notificacao;
CREATE POLICY config_update_regra_notificacao ON public.regra_notificacao AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_delete_regra_permissao ON public.regra_permissao;
CREATE POLICY config_delete_regra_permissao ON public.regra_permissao AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_regra_permissao ON public.regra_permissao;
CREATE POLICY config_insert_regra_permissao ON public.regra_permissao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_regra_permissao ON public.regra_permissao;
CREATE POLICY config_select_regra_permissao ON public.regra_permissao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_regra_permissao ON public.regra_permissao;
CREATE POLICY config_update_regra_permissao ON public.regra_permissao AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS rel_agenda_admin ON public.relatorio_agenda;
CREATE POLICY rel_agenda_admin ON public.relatorio_agenda AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_superadmin())) WITH CHECK ((is_admin() OR is_superadmin()));

DROP POLICY IF EXISTS rel_agenda_select ON public.relatorio_agenda;
CREATE POLICY rel_agenda_select ON public.relatorio_agenda AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rel_dest_admin ON public.relatorio_destinatario;
CREATE POLICY rel_dest_admin ON public.relatorio_destinatario AS PERMISSIVE FOR ALL TO authenticated USING ((is_admin() OR is_superadmin())) WITH CHECK ((is_admin() OR is_superadmin()));

DROP POLICY IF EXISTS rel_dest_select ON public.relatorio_destinatario;
CREATE POLICY rel_dest_select ON public.relatorio_destinatario AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_delete_resposta_auditoria ON public.resposta_auditoria;
CREATE POLICY authenticated_delete_resposta_auditoria ON public.resposta_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_resposta_auditoria ON public.resposta_auditoria;
CREATE POLICY authenticated_insert_resposta_auditoria ON public.resposta_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_resposta_auditoria ON public.resposta_auditoria;
CREATE POLICY authenticated_select_resposta_auditoria ON public.resposta_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_resposta_auditoria ON public.resposta_auditoria;
CREATE POLICY authenticated_update_resposta_auditoria ON public.resposta_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_delete_resposta_inspecao ON public.resposta_inspecao;
CREATE POLICY authenticated_delete_resposta_inspecao ON public.resposta_inspecao AS PERMISSIVE FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_insert_resposta_inspecao ON public.resposta_inspecao;
CREATE POLICY authenticated_insert_resposta_inspecao ON public.resposta_inspecao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_select_resposta_inspecao ON public.resposta_inspecao;
CREATE POLICY authenticated_select_resposta_inspecao ON public.resposta_inspecao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS authenticated_update_resposta_inspecao ON public.resposta_inspecao;
CREATE POLICY authenticated_update_resposta_inspecao ON public.resposta_inspecao AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS admin_delete_servico_voo ON public.servico_voo;
CREATE POLICY admin_delete_servico_voo ON public.servico_voo AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS open_insert_servico_voo ON public.servico_voo;
CREATE POLICY open_insert_servico_voo ON public.servico_voo AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS open_select_servico_voo ON public.servico_voo;
CREATE POLICY open_select_servico_voo ON public.servico_voo AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS open_update_servico_voo ON public.servico_voo;
CREATE POLICY open_update_servico_voo ON public.servico_voo AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS solicitacao_delete ON public.solicitacao_acesso;
CREATE POLICY solicitacao_delete ON public.solicitacao_acesso AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS solicitacao_insert ON public.solicitacao_acesso;
CREATE POLICY solicitacao_insert ON public.solicitacao_acesso AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS solicitacao_select ON public.solicitacao_acesso;
CREATE POLICY solicitacao_select ON public.solicitacao_acesso AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = auth.uid())
 LIMIT 1)) OR (empresa_solicitante_id = current_user_empresa_id())));

DROP POLICY IF EXISTS solicitacao_update ON public.solicitacao_acesso;
CREATE POLICY solicitacao_update ON public.solicitacao_acesso AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (is_admin() AND (empresa_solicitante_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS ss_delete ON public.solicitacao_servico;
CREATE POLICY ss_delete ON public.solicitacao_servico AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS ss_insert_empresa ON public.solicitacao_servico;
CREATE POLICY ss_insert_empresa ON public.solicitacao_servico AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((empresa_id IN ( SELECT users.empresa_id
   FROM users
  WHERE (users.auth_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = auth.uid()) AND (users.empresa_id IS NULL))))));

DROP POLICY IF EXISTS ss_select_empresa ON public.solicitacao_servico;
CREATE POLICY ss_select_empresa ON public.solicitacao_servico AS PERMISSIVE FOR SELECT TO authenticated USING (((empresa_id IN ( SELECT users.empresa_id
   FROM users
  WHERE (users.auth_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = auth.uid()) AND (users.empresa_id IS NULL))))));

DROP POLICY IF EXISTS ss_update_empresa ON public.solicitacao_servico;
CREATE POLICY ss_update_empresa ON public.solicitacao_servico AS PERMISSIVE FOR UPDATE TO authenticated USING (((empresa_id IN ( SELECT users.empresa_id
   FROM users
  WHERE (users.auth_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_id = auth.uid()) AND (users.empresa_id IS NULL))))));

DROP POLICY IF EXISTS empresa_delete_tarifa_permanencia ON public.tarifa_permanencia;
CREATE POLICY empresa_delete_tarifa_permanencia ON public.tarifa_permanencia AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_tarifa_permanencia ON public.tarifa_permanencia;
CREATE POLICY empresa_insert_tarifa_permanencia ON public.tarifa_permanencia AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_tarifa_permanencia ON public.tarifa_permanencia;
CREATE POLICY empresa_select_tarifa_permanencia ON public.tarifa_permanencia AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_tarifa_permanencia ON public.tarifa_permanencia;
CREATE POLICY empresa_update_tarifa_permanencia ON public.tarifa_permanencia AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_tarifa_pouso ON public.tarifa_pouso;
CREATE POLICY empresa_delete_tarifa_pouso ON public.tarifa_pouso AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_tarifa_pouso ON public.tarifa_pouso;
CREATE POLICY empresa_insert_tarifa_pouso ON public.tarifa_pouso AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_tarifa_pouso ON public.tarifa_pouso;
CREATE POLICY empresa_select_tarifa_pouso ON public.tarifa_pouso AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_tarifa_pouso ON public.tarifa_pouso;
CREATE POLICY empresa_update_tarifa_pouso ON public.tarifa_pouso AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_tarifa_recurso ON public.tarifa_recurso;
CREATE POLICY empresa_delete_tarifa_recurso ON public.tarifa_recurso AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_tarifa_recurso ON public.tarifa_recurso;
CREATE POLICY empresa_insert_tarifa_recurso ON public.tarifa_recurso AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_tarifa_recurso ON public.tarifa_recurso;
CREATE POLICY empresa_select_tarifa_recurso ON public.tarifa_recurso AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_tarifa_recurso ON public.tarifa_recurso;
CREATE POLICY empresa_update_tarifa_recurso ON public.tarifa_recurso AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS taxa_cambio_delete ON public.taxa_cambio;
CREATE POLICY taxa_cambio_delete ON public.taxa_cambio AS PERMISSIVE FOR DELETE TO authenticated USING (is_superadmin());

DROP POLICY IF EXISTS taxa_cambio_insert ON public.taxa_cambio;
CREATE POLICY taxa_cambio_insert ON public.taxa_cambio AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS anon_select_taxa_cambio ON public.taxa_cambio;
CREATE POLICY anon_select_taxa_cambio ON public.taxa_cambio AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS taxa_cambio_select ON public.taxa_cambio;
CREATE POLICY taxa_cambio_select ON public.taxa_cambio AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS taxa_cambio_update ON public.taxa_cambio;
CREATE POLICY taxa_cambio_update ON public.taxa_cambio AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS ticket_delete ON public.ticket_suporte;
CREATE POLICY ticket_delete ON public.ticket_suporte AS PERMISSIVE FOR DELETE TO public USING ((is_superadmin() OR is_admin()));

DROP POLICY IF EXISTS ticket_insert ON public.ticket_suporte;
CREATE POLICY ticket_insert ON public.ticket_suporte AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS ticket_select ON public.ticket_suporte;
CREATE POLICY ticket_select ON public.ticket_suporte AS PERMISSIVE FOR SELECT TO public USING ((is_superadmin() OR is_admin() OR (solicitante_auth_id = auth.uid())));

DROP POLICY IF EXISTS ticket_update ON public.ticket_suporte;
CREATE POLICY ticket_update ON public.ticket_suporte AS PERMISSIVE FOR UPDATE TO public USING ((is_superadmin() OR is_admin())) WITH CHECK ((is_superadmin() OR is_admin()));

DROP POLICY IF EXISTS config_delete_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY config_delete_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS empresa_delete_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY empresa_delete_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_insert_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY config_insert_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_insert_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY empresa_insert_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_select_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY config_select_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_select_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY empresa_select_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id IS NULL) OR (empresa_id = current_user_empresa_id())));

DROP POLICY IF EXISTS config_update_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY config_update_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_update_tipo_auditoria ON public.tipo_auditoria;
CREATE POLICY empresa_update_tipo_auditoria ON public.tipo_auditoria AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_delete_tipo_documento ON public.tipo_documento;
CREATE POLICY config_delete_tipo_documento ON public.tipo_documento AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_tipo_documento ON public.tipo_documento;
CREATE POLICY config_insert_tipo_documento ON public.tipo_documento AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS anon_select_tipo_documento ON public.tipo_documento;
CREATE POLICY anon_select_tipo_documento ON public.tipo_documento AS PERMISSIVE FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS config_select_tipo_documento ON public.tipo_documento;
CREATE POLICY config_select_tipo_documento ON public.tipo_documento AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_tipo_documento ON public.tipo_documento;
CREATE POLICY config_update_tipo_documento ON public.tipo_documento AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_delete_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY config_delete_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS empresa_delete_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY empresa_delete_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_insert_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY config_insert_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_insert_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY empresa_insert_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_select_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY config_select_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_select_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY empresa_select_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id IS NULL) OR (empresa_id = current_user_empresa_id())));

DROP POLICY IF EXISTS config_update_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY config_update_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS empresa_update_tipo_inspecao ON public.tipo_inspecao;
CREATE POLICY empresa_update_tipo_inspecao ON public.tipo_inspecao AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS config_delete_tipo_k_p_i ON public.tipo_k_p_i;
CREATE POLICY config_delete_tipo_k_p_i ON public.tipo_k_p_i AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_tipo_k_p_i ON public.tipo_k_p_i;
CREATE POLICY config_insert_tipo_k_p_i ON public.tipo_k_p_i AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_tipo_k_p_i ON public.tipo_k_p_i;
CREATE POLICY config_select_tipo_k_p_i ON public.tipo_k_p_i AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_tipo_k_p_i ON public.tipo_k_p_i;
CREATE POLICY config_update_tipo_k_p_i ON public.tipo_k_p_i AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_delete_tipo_outra_tarifa ON public.tipo_outra_tarifa;
CREATE POLICY config_delete_tipo_outra_tarifa ON public.tipo_outra_tarifa AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_tipo_outra_tarifa ON public.tipo_outra_tarifa;
CREATE POLICY config_insert_tipo_outra_tarifa ON public.tipo_outra_tarifa AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_tipo_outra_tarifa ON public.tipo_outra_tarifa;
CREATE POLICY config_select_tipo_outra_tarifa ON public.tipo_outra_tarifa AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_tipo_outra_tarifa ON public.tipo_outra_tarifa;
CREATE POLICY config_update_tipo_outra_tarifa ON public.tipo_outra_tarifa AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_delete_tipo_servico_geral ON public.tipo_servico_geral;
CREATE POLICY config_delete_tipo_servico_geral ON public.tipo_servico_geral AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS config_insert_tipo_servico_geral ON public.tipo_servico_geral;
CREATE POLICY config_insert_tipo_servico_geral ON public.tipo_servico_geral AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS config_select_tipo_servico_geral ON public.tipo_servico_geral;
CREATE POLICY config_select_tipo_servico_geral ON public.tipo_servico_geral AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_update_tipo_servico_geral ON public.tipo_servico_geral;
CREATE POLICY config_update_tipo_servico_geral ON public.tipo_servico_geral AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (auth_id = auth.uid())));

DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (auth_id = auth.uid()) OR (empresa_id = current_user_empresa_id()) OR (is_admin() AND (empresa_id IS NULL) AND (status = 'pendente'::text))));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (auth_id = auth.uid()) OR (is_admin() AND (empresa_id = current_user_empresa_id())) OR (is_admin() AND (empresa_id IS NULL) AND (status = 'pendente'::text)))) WITH CHECK ((is_superadmin() OR (auth_id = auth.uid()) OR (is_admin() AND (empresa_id = current_user_empresa_id()))));

DROP POLICY IF EXISTS empresa_delete_valor_campo_k_p_i ON public.valor_campo_k_p_i;
CREATE POLICY empresa_delete_valor_campo_k_p_i ON public.valor_campo_k_p_i AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM medicao_k_p_i m
  WHERE ((m.id = valor_campo_k_p_i.medicao_kpi_id) AND (is_superadmin() OR (m.empresa_id = current_user_empresa_id()) OR (m.empresa_id IS NULL))))));

DROP POLICY IF EXISTS empresa_insert_valor_campo_k_p_i ON public.valor_campo_k_p_i;
CREATE POLICY empresa_insert_valor_campo_k_p_i ON public.valor_campo_k_p_i AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM medicao_k_p_i m
  WHERE ((m.id = valor_campo_k_p_i.medicao_kpi_id) AND (is_superadmin() OR (m.empresa_id = current_user_empresa_id()) OR (m.empresa_id IS NULL))))));

DROP POLICY IF EXISTS config_select_valor_campo_k_p_i ON public.valor_campo_k_p_i;
CREATE POLICY config_select_valor_campo_k_p_i ON public.valor_campo_k_p_i AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresa_update_valor_campo_k_p_i ON public.valor_campo_k_p_i;
CREATE POLICY empresa_update_valor_campo_k_p_i ON public.valor_campo_k_p_i AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM medicao_k_p_i m
  WHERE ((m.id = valor_campo_k_p_i.medicao_kpi_id) AND (is_superadmin() OR (m.empresa_id = current_user_empresa_id()) OR (m.empresa_id IS NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM medicao_k_p_i m
  WHERE ((m.id = valor_campo_k_p_i.medicao_kpi_id) AND (is_superadmin() OR (m.empresa_id = current_user_empresa_id()) OR (m.empresa_id IS NULL))))));

DROP POLICY IF EXISTS empresa_delete_voo ON public.voo;
CREATE POLICY empresa_delete_voo ON public.voo AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_voo ON public.voo;
CREATE POLICY empresa_insert_voo ON public.voo AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_voo ON public.voo;
CREATE POLICY empresa_select_voo ON public.voo AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_voo ON public.voo;
CREATE POLICY empresa_update_voo ON public.voo AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_delete_voo_ligado ON public.voo_ligado;
CREATE POLICY empresa_delete_voo_ligado ON public.voo_ligado AS PERMISSIVE FOR DELETE TO authenticated USING ((is_superadmin() OR (is_admin() AND ((empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)))));

DROP POLICY IF EXISTS empresa_insert_voo_ligado ON public.voo_ligado;
CREATE POLICY empresa_insert_voo_ligado ON public.voo_ligado AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_select_voo_ligado ON public.voo_ligado;
CREATE POLICY empresa_select_voo_ligado ON public.voo_ligado AS PERMISSIVE FOR SELECT TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

DROP POLICY IF EXISTS empresa_update_voo_ligado ON public.voo_ligado;
CREATE POLICY empresa_update_voo_ligado ON public.voo_ligado AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL))) WITH CHECK ((is_superadmin() OR (empresa_id = current_user_empresa_id()) OR (empresa_id IS NULL)));

