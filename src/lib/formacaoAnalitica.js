// Analítica de aprendizagem de um curso (ESM puro): funil por aula, tempo de estudo, dificuldade das
// perguntas ao longo do tempo e comparação por aeroporto. Entrada = linhas das tabelas; saída = agregados.
const lower = (s) => String(s || '').toLowerCase();
const media = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const chaveMes = (iso) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function sequenciaAulas(modulos = [], aulas = []) {
  const mods = [...modulos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const out = [];
  for (const m of mods) for (const a of aulas.filter(x => x.modulo_id === m.id).sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0))) out.push({ ...a, modulo: m });
  return out;
}

export function analiticaCurso({ modulos = [], aulas = [], matriculas = [], progresso = [], atividades = [], tentativas = [], users = [], aeroportos = null, hoje = new Date(), meses = 12 }) {
  const seq = sequenciaAulas(modulos, aulas);
  const idxAula = new Map(seq.map((a, i) => [a.id, i]));
  const mats = matriculas.filter(m => m.estado !== 'cancelado');
  const matIds = new Set(mats.map(m => m.id));
  const progValido = progresso.filter(p => matIds.has(p.matricula_id) && idxAula.has(p.aula_id));
  const ativValida = atividades.filter(a => matIds.has(a.matricula_id) && idxAula.has(a.aula_id));

  // ---- por aula: concluída, tempo médio, visitas, abandono (última aula concluída de quem não terminou)
  const feitasPorMat = new Map();
  for (const p of progValido) { if (!feitasPorMat.has(p.matricula_id)) feitasPorMat.set(p.matricula_id, new Set()); feitasPorMat.get(p.matricula_id).add(p.aula_id); }
  const ultimaIdx = new Map(); // matricula -> índice da última aula concluída (-1 se nenhuma)
  for (const m of mats) { let ult = -1; for (const id of feitasPorMat.get(m.id) || []) ult = Math.max(ult, idxAula.get(id)); ultimaIdx.set(m.id, ult); }
  const ativos = mats.filter(m => m.estado !== 'concluido');
  const abandonoPorIdx = new Map();
  for (const m of ativos) { const i = ultimaIdx.get(m.id); abandonoPorIdx.set(i, (abandonoPorIdx.get(i) || 0) + 1); }
  const porAula = seq.map((a, i) => {
    const concl = progValido.filter(p => p.aula_id === a.id).length;
    const ativ = ativValida.filter(x => x.aula_id === a.id);
    const tempos = ativ.map(x => Number(x.tempo_s) || 0).filter(v => v > 0);
    const posicoes = ativ.map(x => Number(x.posicao_s) || 0).filter(v => v > 0);
    return {
      aula: a, indice: i, modulo: a.modulo?.titulo || '', concluida: concl, pctConcluida: pct(concl, mats.length),
      alunos: new Set([...ativ.map(x => x.matricula_id), ...progValido.filter(p => p.aula_id === a.id).map(p => p.matricula_id)]).size,
      tempoMedioS: tempos.length ? Math.round(media(tempos)) : null, tempoTotalS: tempos.reduce((s, v) => s + v, 0),
      visitasMedia: ativ.length ? Math.round(media(ativ.map(x => Number(x.visitas) || 0)) * 10) / 10 : null,
      posicaoMediaS: posicoes.length ? Math.round(media(posicoes)) : null,
      abandonos: abandonoPorIdx.get(i) || 0, // parou depois desta aula (ainda em curso)
      duracaoPrevistaS: a.duracao_min ? Math.round(Number(a.duracao_min) * 60) : null,
    };
  });
  const naoComecaram = abandonoPorIdx.get(-1) || 0;

  // ---- resumo
  const concluidas = mats.filter(m => m.estado === 'concluido');
  const tempoPorMat = new Map();
  for (const x of ativValida) tempoPorMat.set(x.matricula_id, (tempoPorMat.get(x.matricula_id) || 0) + (Number(x.tempo_s) || 0));
  const temposMat = [...tempoPorMat.values()].filter(v => v > 0);
  const diasConclusao = concluidas.map(m => { const ini = new Date(m.reaberta_em || m.created_date); const fim = new Date(m.concluido_em); const d = (fim - ini) / 86400000; return Number.isFinite(d) && d >= 0 ? d : null; }).filter(v => v != null);
  const resumo = {
    inscritos: mats.length, concluidos: concluidas.length, emCurso: ativos.length, naoComecaram,
    taxaConclusao: pct(concluidas.length, mats.length),
    tempoMedioTotalS: temposMat.length ? Math.round(media(temposMat)) : null,
    tempoTotalH: Math.round(([...tempoPorMat.values()].reduce((s, v) => s + v, 0) / 3600) * 10) / 10,
    duracaoPrevistaS: seq.reduce((s, a) => s + (a.duracao_min ? Number(a.duracao_min) * 60 : 0), 0),
    diasMedioConclusao: diasConclusao.length ? Math.round(media(diasConclusao)) : null,
    progressoMedioPct: mats.length ? Math.round(media(mats.map(m => Number(m.progresso_pct) || 0))) : null,
  };

  // ---- perguntas: acerto global e por mês (tendência)
  const fechadas = tentativas.filter(t => t.estado && t.estado !== 'em_curso' && Array.isArray(t.respostas));
  const enunciados = new Map();
  for (const t of tentativas) for (const p of (Array.isArray(t.perguntas) ? t.perguntas : [])) if (p && p.id && !enunciados.has(p.id)) enunciados.set(p.id, { enunciado: p.enunciado, tipo: p.tipo });
  const acc = new Map();
  for (const t of fechadas) {
    const mes = chaveMes(t.submetida_em || t.iniciada_em);
    for (const r of t.respostas) {
      if (!r || !r.pergunta_id || r.pendente) continue;
      const a = acc.get(r.pergunta_id) || { n: 0, certas: 0, parciais: 0, sem: 0, porMes: new Map() };
      a.n++; if (r.correta) a.certas++; else if (r.parcial) a.parciais++; if (!r.respondida) a.sem++;
      if (mes) { const pm = a.porMes.get(mes) || { n: 0, certas: 0 }; pm.n++; if (r.correta) pm.certas++; a.porMes.set(mes, pm); }
      acc.set(r.pergunta_id, a);
    }
  }
  const porPergunta = [...acc.entries()].map(([id, a]) => {
    const mesesOrd = [...a.porMes.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const serie = mesesOrd.map(([mes, v]) => ({ mes, pct: pct(v.certas, v.n), n: v.n }));
    const ult = serie.at(-1), ant = serie.length > 1 ? serie.at(-2) : null;
    return { pergunta_id: id, enunciado: enunciados.get(id)?.enunciado || '(pergunta removida)', tipo: enunciados.get(id)?.tipo || null, n: a.n, certas: a.certas, parciais: a.parciais, sem: a.sem, pct: pct(a.certas, a.n), serie, tendencia: ult && ant && ult.pct != null && ant.pct != null ? Math.round((ult.pct - ant.pct) * 10) / 10 : null };
  }).sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101));

  // ---- por aeroporto (aeroportos de acesso dos utilizadores; só SGA quando fornecida a lista)
  const sga = Array.isArray(aeroportos) ? new Map(aeroportos.map(a => [String(a.codigo_icao || a).toUpperCase(), a.nome ? `${String(a.codigo_icao).toUpperCase()} · ${a.nome}` : String(a.codigo_icao || a).toUpperCase()])) : null;
  const userPorEmail = new Map(users.map(u => [lower(u.email), u]));
  const grupos = new Map();
  const juntar = (codigos, fn) => { for (const c of codigos) { if (!grupos.has(c)) grupos.set(c, { chave: c, inscritos: 0, concluidos: 0, tentativas: 0, aprovados: 0, notas: [], tempos: [] }); fn(grupos.get(c)); } };
  const codigosDe = (email) => { const u = userPorEmail.get(lower(email)); const cods = (u?.aeroportos_acesso || []).map(c => String(c).toUpperCase()); if (!sga) return cods.length ? cods : ['(sem aeroporto)']; return cods.filter(c => sga.has(c)).map(c => sga.get(c)); };
  for (const m of mats) juntar(codigosDe(m.aluno_email), g => { g.inscritos++; if (m.estado === 'concluido') g.concluidos++; const tp = tempoPorMat.get(m.id); if (tp) g.tempos.push(tp); });
  for (const t of fechadas) juntar(codigosDe(t.aluno_email), g => { g.tentativas++; if (t.aprovado === true) g.aprovados++; if (Number.isFinite(Number(t.nota))) g.notas.push(Number(t.nota)); });
  const porAeroporto = [...grupos.values()].map(g => ({ chave: g.chave, inscritos: g.inscritos, concluidos: g.concluidos, taxaConclusao: pct(g.concluidos, g.inscritos), tentativas: g.tentativas, aprovacaoPct: pct(g.aprovados, g.tentativas), notaMedia: g.notas.length ? Math.round(media(g.notas) * 10) / 10 : null, tempoMedioS: g.tempos.length ? Math.round(media(g.tempos)) : null })).sort((a, b) => b.inscritos - a.inscritos);

  // ---- por mês: inscrições, conclusões, tentativas, horas de estudo (pela última actividade)
  const porMes = [];
  const base = new Date(hoje); base.setDate(1);
  for (let i = meses - 1; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1); porMes.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MESES_PT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, inscricoes: 0, conclusoes: 0, tentativas: 0, horas: 0 }); }
  const idx = new Map(porMes.map((m, i) => [m.mes, i]));
  for (const m of mats) { const k = chaveMes(m.created_date); if (idx.has(k)) porMes[idx.get(k)].inscricoes++; if (m.estado === 'concluido') { const k2 = chaveMes(m.concluido_em); if (idx.has(k2)) porMes[idx.get(k2)].conclusoes++; } }
  for (const t of fechadas) { const k = chaveMes(t.submetida_em || t.iniciada_em); if (idx.has(k)) porMes[idx.get(k)].tentativas++; }
  for (const x of ativValida) { const k = chaveMes(x.ultima_em); if (idx.has(k)) porMes[idx.get(k)].horas += (Number(x.tempo_s) || 0) / 3600; }
  for (const m of porMes) m.horas = Math.round(m.horas * 10) / 10;

  return { resumo, porAula, porPergunta, porAeroporto, porMes, naoComecaram };
}

export function fmtSegundos(s) {
  const n = Math.round(Number(s) || 0);
  if (!n) return '—';
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  return `${Math.floor(n / 3600)} h ${Math.round((n % 3600) / 60)} min`;
}
