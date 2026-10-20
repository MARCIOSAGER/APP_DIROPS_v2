-- Auditoria da lógica de matrícula/progresso/pontos/validade/certificado/recertificação para TODOS os cursos,
-- numa transacção que termina em ROLLBACK (nada fica gravado). Correr com psql (ON_ERROR_STOP).
\pset format unaligned
\pset fieldsep ' | '
BEGIN;
CREATE TEMP TABLE audit_res (curso text, passo text, resultado text, ok boolean) ON COMMIT DROP;
DO $$
DECLARE c record; m public.matricula; a record; n_aulas int; esperado text; pts int; tem_quiz boolean; cert record; nc int;
  EMAIL constant text := 'auditoria.teste@sga.co.ao';
BEGIN
  FOR c IN SELECT * FROM public.curso WHERE deleted_at IS NULL ORDER BY titulo LOOP
    INSERT INTO public.matricula (curso_id, aluno_email, aluno_nome, estado, progresso_pct, origem)
    VALUES (c.id, EMAIL, 'Auditoria Teste', 'ativo', 0, 'gestor') RETURNING * INTO m;
    INSERT INTO audit_res VALUES (c.titulo, '1 matrícula criada', 'versao=' || coalesce(m.versao::text, 'null') || ' ciclo=' || m.ciclo || ' valido_ate=' || coalesce(m.valido_ate::text, 'null'), m.versao IS NOT NULL AND m.ciclo = 1 AND m.valido_ate IS NULL);
    n_aulas := 0;
    FOR a IN SELECT au.id FROM public.aula au JOIN public.modulo mo ON mo.id = au.modulo_id WHERE mo.curso_id = c.id LOOP
      INSERT INTO public.progresso_aula (matricula_id, aula_id, concluida, concluida_em) VALUES (m.id, a.id, true, now());
      n_aulas := n_aulas + 1;
    END LOOP;
    -- metade das aulas → progresso parcial
    SELECT * INTO m FROM public.recalcular_matricula(m.id);
    SELECT EXISTS (SELECT 1 FROM public.quiz q WHERE q.curso_id = c.id AND q.ativo AND q.gera_certificado) INTO tem_quiz;
    esperado := CASE WHEN tem_quiz THEN 'ativo' ELSE 'concluido' END;
    INSERT INTO audit_res VALUES (c.titulo, '2 recalcular com ' || n_aulas || ' aulas concluídas', 'progresso=' || m.progresso_pct || '% estado=' || m.estado || ' (esperado 100% / ' || esperado || ')', m.progresso_pct = 100 AND m.estado = esperado);
    SELECT coalesce(sum(pontos), 0) INTO pts FROM public.pontos_formacao WHERE aluno_email = EMAIL AND curso_id = c.id AND tipo = 'aula';
    INSERT INTO audit_res VALUES (c.titulo, '3 pontos por aula', pts || ' (esperado ' || (n_aulas * 10) || ')', pts = n_aulas * 10);
    INSERT INTO audit_res VALUES (c.titulo, '4 distintivo primeiro passo', (SELECT count(*)::text FROM public.aluno_distintivo WHERE aluno_email = EMAIL AND codigo = 'primeiro_passo'), EXISTS (SELECT 1 FROM public.aluno_distintivo WHERE aluno_email = EMAIL AND codigo = 'primeiro_passo'));
    -- conclusão (como o servidor faz ao aprovar na avaliação)
    UPDATE public.matricula SET estado = 'concluido', concluido_em = now() WHERE id = m.id RETURNING * INTO m;
    INSERT INTO audit_res VALUES (c.titulo, '5 validade após conclusão', 'validade_meses=' || coalesce(c.validade_meses::text, 'null') || ' → valido_ate=' || coalesce(m.valido_ate::date::text, 'null'),
      (c.validade_meses IS NULL AND m.valido_ate IS NULL) OR (c.validade_meses IS NOT NULL AND m.valido_ate::date = (now() + (c.validade_meses || ' months')::interval)::date));
    SELECT coalesce(sum(pontos), 0) INTO pts FROM public.pontos_formacao WHERE aluno_email = EMAIL AND curso_id = c.id AND tipo = 'curso';
    INSERT INTO audit_res VALUES (c.titulo, '6 pontos por curso concluído', pts || ' (esperado 50)', pts = 50);
    -- certificado (inserção como a app faz) → validade e versão por trigger
    INSERT INTO public.certificado (numero, token, aluno_nome, aluno_email, curso_id, curso_titulo, matricula_id, emitido_em, carga_horaria, ciclo)
    VALUES ('AUDIT-' || left(c.id::text, 8), 'audit' || left(md5(c.id::text), 20), 'Auditoria Teste', EMAIL, c.id, c.titulo, m.id, now(), c.carga_horaria, m.ciclo) RETURNING * INTO cert;
    INSERT INTO audit_res VALUES (c.titulo, '7 certificado emitido', 'versao=' || coalesce(cert.versao::text, 'null') || ' valido_ate=' || coalesce(cert.valido_ate::date::text, 'null') || ' carga=' || coalesce(cert.carga_horaria::text, 'null'),
      cert.versao = m.versao AND ((c.validade_meses IS NULL AND cert.valido_ate IS NULL) OR (c.validade_meses IS NOT NULL AND cert.valido_ate IS NOT NULL)));
    -- licença de condução (quando o curso sincroniza)
    IF c.sincroniza_licenca_conducao THEN
      SELECT count(*) INTO nc FROM public.licenca_conducao WHERE lower(aluno_email) = EMAIL;
      INSERT INTO audit_res VALUES (c.titulo, '8 licença de condução criada', nc::text, nc >= 1);
    END IF;
    -- recertificação
    IF c.validade_meses IS NOT NULL THEN
      SELECT * INTO m FROM public.reabrir_matricula(m.id);
      INSERT INTO audit_res VALUES (c.titulo, '9 reabrir_matricula', 'ciclo=' || m.ciclo || ' estado=' || m.estado || ' progresso=' || m.progresso_pct || ' aulas=' || (SELECT count(*) FROM public.progresso_aula WHERE matricula_id = m.id), m.estado = 'ativo' AND m.progresso_pct = 0 AND m.ciclo = 2 AND (SELECT count(*) FROM public.progresso_aula WHERE matricula_id = m.id) = 0);
    END IF;
    -- versão de curso
    IF public.pode_editar_curso(c.id) OR true THEN
      BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('email', c.instrutor_email, 'role', 'authenticated')::text, true);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;
END $$;
SELECT curso, passo, resultado, CASE WHEN ok THEN 'OK' ELSE '*** FALHA ***' END AS estado FROM audit_res ORDER BY curso, passo;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS falhas FROM audit_res;
ROLLBACK;
