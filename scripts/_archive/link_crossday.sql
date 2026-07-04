-- Count potential cross-day pairs (max 3 days between ARR and DEP)
WITH ua AS (
  SELECT id, registo_aeronave, data_operacao, horario_real,
    ROW_NUMBER() OVER (PARTITION BY registo_aeronave ORDER BY data_operacao, COALESCE(horario_real, '00:00')) as rn
  FROM voo
  WHERE origem_dados = 'AIAAN_IMPORT' AND tipo_movimento = 'ARR'
    AND voo_ligado_id IS NULL AND registo_aeronave != '' AND registo_aeronave IS NOT NULL
),
ud AS (
  SELECT id, registo_aeronave, data_operacao, horario_previsto,
    ROW_NUMBER() OVER (PARTITION BY registo_aeronave ORDER BY data_operacao, COALESCE(horario_previsto, '00:00')) as rn
  FROM voo
  WHERE origem_dados = 'AIAAN_IMPORT' AND tipo_movimento = 'DEP'
    AND voo_ligado_id IS NULL AND registo_aeronave != '' AND registo_aeronave IS NOT NULL
)
SELECT count(*) as pairs
FROM ua JOIN ud ON ua.registo_aeronave = ud.registo_aeronave AND ua.rn = ud.rn
WHERE ud.data_operacao::date >= ua.data_operacao::date
  AND ud.data_operacao::date <= ua.data_operacao::date + 3;
