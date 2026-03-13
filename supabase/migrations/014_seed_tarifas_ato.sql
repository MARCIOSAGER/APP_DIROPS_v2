-- Migration 014: Seed tarifas da ATO
-- Empresa ATO: 031274b1-d4eb-42a6-8080-44c0bb31a455
-- Valores conforme tabela de tarifas ATO (categoria_1 = Aeroporto 4 de Fevereiro)

-- ==================== TARIFAS DE POUSO (USD por tonelada) ====================
INSERT INTO public.tarifa_pouso (faixa_min, faixa_max, tarifa_internacional, tarifa_domestica, categoria_aeroporto, status, empresa_id) VALUES
  (0,      10000,  7.21, 4.53, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  (10001,  25000,  6.62, 4.05, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  (25001,  75000,  7.53, 4.48, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  (75001,  150000, 8.26, 5.07, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455'),
  (150001, 999999, 8.10, 5.39, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- ==================== TARIFA DE ESTACIONAMENTO (USD por tonelada/hora) ====================
-- 0.25 USD/ton/hora base, +50% após 6h (já implementado no código de cálculo)
INSERT INTO public.tarifa_permanencia (faixa_min, faixa_max, tarifa_usd_por_tonelada_hora, categoria_aeroporto, status, empresa_id) VALUES
  (0, 999999, 0.25, 'categoria_1', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- ==================== OUTRAS TARIFAS ====================

-- Embarque Internacional: 28.21 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('embarque', 'internacional', 28.21, 'passageiro', 'categoria_1', 'Tarifa de embarque - Passageiros internacionais', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Embarque Doméstico: 10.00 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('embarque', 'domestica', 10.00, 'passageiro', 'categoria_1', 'Tarifa de embarque - Passageiros domésticos', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Conexão (Trânsito com Transbordo) Internacional: 10.00 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('transito_transbordo', 'internacional', 10.00, 'passageiro', 'categoria_1', 'Tarifa de conexão - Passageiros internacionais', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Conexão (Trânsito com Transbordo) Doméstico: 10.00 USD/passageiro
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('transito_transbordo', 'domestica', 10.00, 'passageiro', 'categoria_1', 'Tarifa de conexão - Passageiros domésticos', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- Iluminação (Sinalização Luminosa): 197.88 USD (mesmo valor dom/int)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('iluminacao', 'ambos', 197.88, 'voo', 'categoria_1', 'Sinalização luminosa - Aterragem/descolagem após ou antes do pôr do sol', 'ativa', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- ==================== TARIFAS DE RECURSOS ====================

-- PBB (Pontes Telescópicas / Mangas): 150 USD 1ª hora, 74 USD hora adicional
INSERT INTO public.tarifa_recurso (tipo, valor_usd, categoria_aeroporto, tipo_operacao, status, descricao, empresa_id, primeira_hora, hora_adicional) VALUES
  ('pbb', 74.00, 'categoria_1', 'ambos', 'ativa', 'Ponte Telescópica (Manga) - 1ª hora 150 USD, horas adicionais 74 USD', '031274b1-d4eb-42a6-8080-44c0bb31a455', 150.00, 74.00);

-- GPU: 90.00 USD/hora
INSERT INTO public.tarifa_recurso (tipo, valor_usd, categoria_aeroporto, tipo_operacao, status, descricao, empresa_id) VALUES
  ('gpu', 90.00, 'categoria_1', 'ambos', 'ativa', 'Energia (GPU) - Por hora ou fracção', '031274b1-d4eb-42a6-8080-44c0bb31a455');

-- PCA: 90.00 USD/hora (mesmo valor do GPU conforme tabela)
INSERT INTO public.tarifa_recurso (tipo, valor_usd, categoria_aeroporto, tipo_operacao, status, descricao, empresa_id) VALUES
  ('pca', 90.00, 'categoria_1', 'ambos', 'ativa', 'Ar Condicionado (PCA) - Por hora ou fracção', '031274b1-d4eb-42a6-8080-44c0bb31a455');
