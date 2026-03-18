-- Migration 036: Fix RLS policies for registo_aeronave, companhia_aerea, modelo_aeronave
-- Applied directly via API on 2026-03-18
-- Problem: INSERT/UPDATE policies only allowed is_admin(), blocking operacoes users
--   from creating new entries during flight creation (FormVoo)

-- Allow all authenticated users to insert/update these operational reference tables
DROP POLICY IF EXISTS config_insert_registo_aeronave ON public.registo_aeronave;
CREATE POLICY "config_insert_registo_aeronave" ON public.registo_aeronave
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS config_update_registo_aeronave ON public.registo_aeronave;
CREATE POLICY "config_update_registo_aeronave" ON public.registo_aeronave
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_insert_companhia_aerea ON public.companhia_aerea;
CREATE POLICY "config_insert_companhia_aerea" ON public.companhia_aerea
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS config_update_companhia_aerea ON public.companhia_aerea;
CREATE POLICY "config_update_companhia_aerea" ON public.companhia_aerea
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_insert_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY "config_insert_modelo_aeronave" ON public.modelo_aeronave
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS config_update_modelo_aeronave ON public.modelo_aeronave;
CREATE POLICY "config_update_modelo_aeronave" ON public.modelo_aeronave
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
