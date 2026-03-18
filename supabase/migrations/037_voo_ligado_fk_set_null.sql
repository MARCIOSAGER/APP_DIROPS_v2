-- Migration 037: Fix FK constraints on voo_ligado references
-- Applied directly via API on 2026-03-18
-- Problem: proforma_item and calculo_tarifa had NO ACTION FK to voo_ligado,
--   blocking DELETE of voo_ligado when proformas/calculations existed

ALTER TABLE public.proforma_item
  DROP CONSTRAINT IF EXISTS proforma_item_voo_ligado_id_fkey,
  ADD CONSTRAINT proforma_item_voo_ligado_id_fkey
    FOREIGN KEY (voo_ligado_id) REFERENCES public.voo_ligado(id) ON DELETE SET NULL;

ALTER TABLE public.calculo_tarifa
  DROP CONSTRAINT IF EXISTS calculo_tarifa_voo_ligado_id_fkey,
  ADD CONSTRAINT calculo_tarifa_voo_ligado_id_fkey
    FOREIGN KEY (voo_ligado_id) REFERENCES public.voo_ligado(id) ON DELETE SET NULL;
