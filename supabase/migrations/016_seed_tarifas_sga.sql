-- Migration 016: Re-inserir tarifas SGA com empresa_id
-- Empresa SGA, SA: 128bc692-3fae-4825-9c55-40565dbedcfb
-- Dados recuperados do sistema anterior (antes da limpeza 015)

-- ==================== TARIFAS DE POUSO (20 registos, 4 categorias x 5 faixas) ====================

INSERT INTO public.tarifa_pouso (faixa_min, faixa_max, tarifa_domestica, tarifa_internacional, categoria_aeroporto, status, empresa_id) VALUES
  -- Categoria 1 (Aeroporto 4 de Fevereiro)
  (0,      10000,  4.53, 7.21, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (10001,  25000,  4.05, 6.62, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (25001,  75000,  4.48, 7.53, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (75001,  150000, 5.07, 8.26, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (150001, 999999, 5.39, 8.10, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  -- Categoria 2
  (0,      10000,  3.50, 5.54, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (10001,  25000,  3.13, 5.09, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (25001,  75000,  3.46, 5.79, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (75001,  150000, 3.92, 6.35, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (150001, 999999, 4.16, 6.23, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  -- Categoria 3
  (0,      10000,  3.10, 3.10, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (10001,  25000,  2.77, 2.77, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (25001,  75000,  3.07, 3.07, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (75001,  150000, 3.48, 3.48, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (150001, 999999, 3.69, 3.69, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  -- Categoria 4
  (0,      10000,  2.41, 2.41, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (10001,  25000,  2.15, 2.15, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (25001,  75000,  2.38, 2.38, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (75001,  150000, 2.70, 2.70, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (150001, 999999, 2.86, 2.86, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- ==================== TARIFAS DE ESTACIONAMENTO (4 registos, 4 categorias) ====================

INSERT INTO public.tarifa_permanencia (faixa_min, faixa_max, tarifa_usd_por_tonelada_hora, categoria_aeroporto, status, empresa_id) VALUES
  (0, 999999, 0.25, 'categoria_1', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (0, 999999, 0.20, 'categoria_2', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (0, 999999, 0.16, 'categoria_3', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  (0, 999999, 0.12, 'categoria_4', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- ==================== OUTRAS TARIFAS ====================

-- Carga Doméstico (4 categorias) - 0.07 USD/kg = 70 USD/ton
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('carga', 'domestica', 70.00, 'tonelada', 'categoria_1', 'Não sujeita a despacho (apenas embarque) – 0,07 USD/kg (equivalente a 70 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'domestica', 70.00, 'tonelada', 'categoria_2', 'Não sujeita a despacho (apenas embarque) – 0,07 USD/kg (equivalente a 70 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'domestica', 70.00, 'tonelada', 'categoria_3', 'Não sujeita a despacho (apenas embarque) – 0,07 USD/kg (equivalente a 70 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'domestica', 70.00, 'tonelada', 'categoria_4', 'Não sujeita a despacho (apenas embarque) – 0,07 USD/kg (equivalente a 70 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Carga Internacional (4 categorias) - 0.08 USD/kg = 80 USD/ton
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('carga', 'internacional', 80.00, 'tonelada', 'categoria_1', 'Sujeita a despacho aduaneiro – 0,08 USD/kg (equivalente a 80 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'internacional', 80.00, 'tonelada', 'categoria_2', 'Sujeita a despacho aduaneiro – 0,08 USD/kg (equivalente a 80 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'internacional', 80.00, 'tonelada', 'categoria_3', 'Sujeita a despacho aduaneiro – 0,08 USD/kg (equivalente a 80 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('carga', 'internacional', 80.00, 'tonelada', 'categoria_4', 'Sujeita a despacho aduaneiro – 0,08 USD/kg (equivalente a 80 USD/ton)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Embarque Internacional (4 categorias)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('embarque', 'internacional', 28.21, 'passageiro', 'categoria_1', 'Internacional – conforme RTA 2015 (Anexo I – 1.5)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'internacional', 21.16, 'passageiro', 'categoria_2', 'Internacional – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'internacional', 17.63, 'passageiro', 'categoria_3', 'Internacional – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'internacional', 14.11, 'passageiro', 'categoria_4', 'Internacional – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Embarque Doméstico (4 categorias)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('embarque', 'domestica', 10.00, 'passageiro', 'categoria_1', 'Doméstico – conforme RTA 2015 (Anexo I – 1.5)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'domestica', 8.00, 'passageiro', 'categoria_2', 'Doméstico – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'domestica', 6.50, 'passageiro', 'categoria_3', 'Doméstico – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('embarque', 'domestica', 5.00, 'passageiro', 'categoria_4', 'Doméstico – conforme RTA 2015', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Iluminação (5 registos - Cat 1 tem 2 pistas, Cat 2-4 têm 1)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('iluminacao', 'ambos', 87.30, 'voo', 'categoria_1', 'Pista 25/07 – balizagem luminosa (por operação)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('iluminacao', 'ambos', 197.88, 'voo', 'categoria_1', 'Pista 23/05 – balizagem luminosa (por operação)', 'inativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('iluminacao', 'ambos', 87.30, 'voo', 'categoria_2', 'Balizagem luminosa (por operação)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('iluminacao', 'ambos', 34.98, 'voo', 'categoria_3', 'Balizagem luminosa (por operação)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('iluminacao', 'ambos', 34.98, 'voo', 'categoria_4', 'Balizagem luminosa (por operação)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Segurança (inativa)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('seguranca', 'ambos', 0.00, 'fixa', 'categoria_1', 'Uso interno, fora do RTA 2015. Ativar apenas com base em deliberação própria.', 'inativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Trânsito Direto (4 categorias - isento)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('transito_direto', 'ambos', 0.00, 'passageiro', 'categoria_1', 'Isento – passageiros em trânsito directo (art. 12.º, n.º 3, al. c)', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('transito_direto', 'ambos', 0.00, 'passageiro', 'categoria_2', 'Isento – passageiros em trânsito directo', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('transito_direto', 'ambos', 0.00, 'passageiro', 'categoria_3', 'Isento – passageiros em trânsito directo', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb'),
  ('transito_direto', 'ambos', 0.00, 'passageiro', 'categoria_4', 'Isento – passageiros em trânsito directo', 'ativa', '128bc692-3fae-4825-9c55-40565dbedcfb');

-- Trânsito com Transbordo (inativo - placeholder)
INSERT INTO public.outra_tarifa (tipo, tipo_operacao, valor, unidade, categoria_aeroporto, descricao, status, empresa_id) VALUES
  ('transito_transbordo', 'ambos', 0.00, 'passageiro', 'categoria_1', 'Placeholder para política interna – preencher se aprovado pela SGA/ANAC.', 'inativa', '128bc692-3fae-4825-9c55-40565dbedcfb');
