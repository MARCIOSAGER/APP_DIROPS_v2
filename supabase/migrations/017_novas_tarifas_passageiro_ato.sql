-- Migration 017: Novas tarifas de passageiro/serviço para ATO
-- Empresa ATO: 031274b1-d4eb-42a6-8080-44c0bb31a455
-- Valores conforme tabela de tarifas ATO (categoria_1 = Aeroporto AIAAN)

-- Remover check-in de tarifa_recurso (agora é outra_tarifa)
DELETE FROM public.tarifa_recurso WHERE tipo = 'checkin';

-- ==================== NOVAS TARIFAS (outra_tarifa) ====================

-- Check-in (Assistência ao Passageiro): 17.00 USD/balcão/hora internacional, 9.00 doméstico
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('checkin', 'internacional', 17.00, 'balcao_hora', 'categoria_1', 'Assistência ao Passageiro (Check In) – por hora e por balcão', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  ('checkin', 'domestica', 9.00, 'balcao_hora', 'categoria_1', 'Assistência ao Passageiro (Check In) – por hora e por balcão', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- CUPPSS / CUSS: 0.19 USD/passageiro (mesmo valor dom/int)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('cuppss', 'internacional', 0.19, 'passageiro', 'categoria_1', 'CUPPSS e CUSS (Common Use Passenger Processing System) – por passageiro embarcado', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  ('cuppss', 'domestica', 0.19, 'passageiro', 'categoria_1', 'CUPPSS e CUSS (Common Use Passenger Processing System) – por passageiro embarcado', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Assistência ao Passageiro com necessidades especiais: 0.70 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('assistencia_especial', 'ambos', 0.70, 'passageiro', 'categoria_1', 'Assistência ao Passageiro com necessidades especiais – por passageiro embarcado', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Serviço Fast Track Premium (Canal Verde): 10.00 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('fast_track', 'ambos', 10.00, 'passageiro', 'categoria_1', 'Serviço Fast Track Premium (Canal Verde) – opcional', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Assistência à Bagagem: 0.16 USD/passageiro embarcado
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('assistencia_bagagem', 'internacional', 0.16, 'passageiro', 'categoria_1', 'Assistência à Bagagem – por passageiro embarcado e desembarcado', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  ('assistencia_bagagem', 'domestica', 0.16, 'passageiro', 'categoria_1', 'Assistência à Bagagem – por passageiro embarcado e desembarcado', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- BRS (Baggage Reconciliation System): 0.08 USD/bagagem
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('brs', 'internacional', 0.08, 'bagagem', 'categoria_1', 'BRS (Baggage Reconciliation System) – por bagagem embarcada', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  ('brs', 'domestica', 0.08, 'bagagem', 'categoria_1', 'BRS (Baggage Reconciliation System) – por bagagem embarcada', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');
