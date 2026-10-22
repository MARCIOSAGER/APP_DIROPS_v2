// Indicadores agregados da formação (visão geral + relatório semanal). ESM puro, sem React,
// partilhado pelo frontend e pelos scripts node. Parte da matriz (matrizFormacao) já calculada.
import { diasAte } from './formacaoEstado.js';
import { PERFIL_UC_LABEL } from './universidade.js';

export const ESTADOS_VALIDOS = new Set(['valido', 'concluido', 'a_expirar']);
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lower = (s) => String(s || '').toLowerCase();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const chaveMes = (iso) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const media = (arr) => (arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null);

// Conformidade por grupo (perfil, aeroporto): obrigatórios válidos / obrigatórios devidos.
function conformidadePorGrupo(linhas, grupoDe) {
  const acc = new Map();
  for (const l of linhas) {
    const grupos = grupoDe(l.user);
    const cels = l.celulas.filter(c => c.obrigatorio);
    for (const g of grupos) {
      const a = acc.get(g) || { chave: g, pessoas: 0, devidos: 0, validos: 0, emFalta: 0, expirados: 0 };
      a.pessoas++;
      for (const c of cels) { a.devidos++; if (ESTADOS_VALIDOS.has(c.estado)) a.validos++; if (c.estado === 'em_falta') a.emFalta++; if (c.estado === 'expirado') a.expirados++; }
      acc.set(g, a);
    }
  }
  return [...acc.values()].map(a => ({ ...a, pct: pct(a.validos, a.devidos) })).sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101) || y.devidos - x.devidos);
}

// aeroportos (opcional): [{ codigo_icao, nome }] dos aeroportos da SGA — a conformidade por aeroporto
// só considera estes códigos (colaboradores sem nenhum deles ficam fora dessa repartição).
export function indicadoresFormacao({ matriz, cursos = [], matriculas = [], tentativas = [], quizzes = [], certificados = [], externas = [], atividades = [], aeroportos = null, hoje = new Date(), meses = 12 }) {
  const linhas = matriz?.linhas || [];
  // horas de estudo (aula_atividade) por curso, via matrícula
  const cursoDaMat = new Map((matriculas || []).map(m => [m.id, m.curso_id]));
  const segPorCurso = new Map(); let segTotal = 0;
  for (const a of atividades || []) { const s = Number(a.tempo_s) || 0; if (!s) continue; segTotal += s; const cid = cursoDaMat.get(a.matricula_id); if (cid) segPorCurso.set(cid, (segPorCurso.get(cid) || 0) + s); }
  const sga = Array.isArray(aeroportos) ? new Map(aeroportos.map(a => [String(a.codigo_icao || a).toUpperCase(), a.nome ? `${String(a.codigo_icao).toUpperCase()} · ${a.nome}` : String(a.codigo_icao || a).toUpperCase()])) : null;
  const gruposAeroporto = (u) => {
    const codigos = (u.aeroportos_acesso || []).map(c => String(c).toUpperCase());
    if (!sga) return codigos.length ? codigos : ['(sem aeroporto)'];
    return codigos.filter(c => sga.has(c)).map(c => sga.get(c));
  };

  // conformidade global
  let devidos = 0, validos = 0;
  for (const l of linhas) for (const c of l.celulas) if (c.obrigatorio) { devidos++; if (ESTADOS_VALIDOS.has(c.estado)) validos++; }
  const conformidade = { devidos, validos, pct: pct(validos, devidos) };
  // Agrupa pelos perfis da Universidade (não pelos perfis de função do DIROPS); sem perfil da Universidade = Formando.
  const PERFIL_UC = PERFIL_UC_LABEL; // inclui os perfis próprios (migração 188) quando carregados
  const porPerfil = conformidadePorGrupo(linhas, u => { const uc = (u.perfis || []).filter(p => PERFIL_UC[p]).map(p => PERFIL_UC[p]); return uc.length ? uc : ['Formando']; });
  const porAeroporto = conformidadePorGrupo(linhas, gruposAeroporto);

  // vencimentos por janela (exclusivas) + expirados
  const vencimentos = { expirados: [], d30: [], d60: [], d90: [] };
  for (const l of linhas) for (const c of l.celulas) {
    if (!c.validoAte || !['valido', 'a_expirar', 'expirado'].includes(c.estado)) continue;
    const dias = c.dias ?? diasAte(c.validoAte, hoje);
    const item = { user: l.user, curso: c.curso, validoAte: c.validoAte, dias, origem: c.origem, obrigatorio: c.obrigatorio, matricula: c.matricula };
    if (dias < 0) vencimentos.expirados.push(item);
    else if (dias <= 30) vencimentos.d30.push(item);
    else if (dias <= 60) vencimentos.d60.push(item);
    else if (dias <= 90) vencimentos.d90.push(item);
  }
  for (const k of Object.keys(vencimentos)) vencimentos[k].sort((a, b) => a.dias - b.dias);

  // por curso: cobertura (matriz) + matrículas + avaliações
  const quizCurso = new Map((quizzes || []).map(q => [q.id, q.curso_id]));
  const tentPorCurso = new Map();
  for (const t of tentativas || []) { if (t.estado === 'em_curso') continue; const cid = quizCurso.get(t.quiz_id); if (!cid) continue; if (!tentPorCurso.has(cid)) tentPorCurso.set(cid, []); tentPorCurso.get(cid).push(t); }
  const matPorCurso = new Map();
  for (const m of matriculas || []) { if (!matPorCurso.has(m.curso_id)) matPorCurso.set(m.curso_id, []); matPorCurso.get(m.curso_id).push(m); }
  const porCurso = (matriz?.porCurso || []).map(pc => {
    const c = pc.contagens || {};
    const ms = matPorCurso.get(pc.curso.id) || [];
    const concl = ms.filter(m => m.estado === 'concluido' && m.concluido_em);
    const duracoes = concl.map(m => { const ini = new Date(m.reaberta_em || m.created_date); const fim = new Date(m.concluido_em); const d = (fim - ini) / 86400000; return Number.isFinite(d) && d >= 0 ? d : null; }).filter(v => v != null);
    const ts = tentPorCurso.get(pc.curso.id) || [];
    const notas = ts.map(t => Number(t.nota)).filter(Number.isFinite);
    const aprov = ts.filter(t => t.aprovado === true).length;
    const atrasados = (matriz.linhas || []).flatMap(l => l.celulas.filter(x => x.curso.id === pc.curso.id && x.estado === 'atrasado').map(x => ({ user: l.user, matricula: x.matricula })));
    return {
      curso: pc.curso, obrigatorioPara: pc.obrigatorioPara,
      em_falta: c.em_falta || 0, atrasado: c.atrasado || 0, em_curso: c.em_curso || 0, valido: (c.valido || 0) + (c.concluido || 0), a_expirar: c.a_expirar || 0, expirado: c.expirado || 0,
      conformidadePct: pc.obrigatorioPara > 0 ? pct(((c.valido || 0) + (c.concluido || 0) + (c.a_expirar || 0)) - 0, pc.obrigatorioPara) : null,
      inscritos: ms.length, concluidos: concl.length, tempoMedioDias: duracoes.length ? Math.round(media(duracoes)) : null,
      tentativas: ts.length, aprovacaoPct: pct(aprov, ts.length), notaMedia: media(notas), porCorrigir: ts.filter(t => t.correcao_pendente).length,
      atrasados,
      horasEstudo: Math.round(((segPorCurso.get(pc.curso.id) || 0) / 3600) * 10) / 10,
    };
  });
  // conformidade por curso deve contar só células obrigatórias válidas
  for (const pc of porCurso) {
    if (pc.obrigatorioPara > 0) {
      let v = 0;
      for (const l of linhas) { const cel = l.celulas.find(x => x.curso.id === pc.curso.id); if (cel && cel.obrigatorio && ESTADOS_VALIDOS.has(cel.estado)) v++; }
      pc.conformidadePct = pct(v, pc.obrigatorioPara); pc.obrigatoriosValidos = v;
    }
  }

  // actividade mensal
  const atividade = [];
  const base = new Date(hoje); base.setDate(1);
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    atividade.push({ mes, label: `${MESES_PT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, inscricoes: 0, conclusoes: 0, certificados: 0 });
  }
  const idx = new Map(atividade.map((a, i) => [a.mes, i]));
  for (const m of matriculas || []) { const k1 = chaveMes(m.created_date); if (idx.has(k1)) atividade[idx.get(k1)].inscricoes++; const k2 = m.estado === 'concluido' ? chaveMes(m.concluido_em) : null; if (k2 && idx.has(k2)) atividade[idx.get(k2)].conclusoes++; }
  for (const c of certificados || []) { if (c.revogado_em) continue; const k = chaveMes(c.emitido_em); if (idx.has(k)) atividade[idx.get(k)].certificados++; }

  // formação externa
  const ext = (externas || []).filter(e => !e.deleted_at);
  const externasInfo = { total: ext.length, aExpirar90: ext.filter(e => { const d = diasAte(e.valido_ate, hoje); return d != null && d >= 0 && d <= 90; }).length, expiradas: ext.filter(e => { const d = diasAte(e.valido_ate, hoje); return d != null && d < 0; }).length };

  const porCorrigir = (tentativas || []).filter(t => t.correcao_pendente).length;
  const comPendencias = linhas.filter(l => l.pendencias > 0).length;
  const inscritos = new Set((matriculas || []).map(m => lower(m.aluno_email))).size;
  const totais = matriz?.totais || {};
  return { conformidade, porPerfil, porAeroporto, vencimentos, porCurso, atividade, externas: externasInfo, porCorrigir, comPendencias, inscritos, colaboradores: linhas.length, totais, horasEstudo: Math.round((segTotal / 3600) * 10) / 10 };
}
