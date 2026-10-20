// Lógica partilhada (frontend + scripts node) do estado de formação de cada
// colaborador × curso: obrigatoriedade, validade, recertificação, formação externa e matriz.
// Sem dependências de React nem do browser.

export const DIAS_AVISO_EXPIRACAO = 30;
export const DIAS_LEMBRETE = [7, 21];

export const ESTADOS = {
  em_falta:      { label: 'Em falta',      cor: 'red',     ordem: 0, descricao: 'Obrigatório e ainda sem inscrição' },
  expirado:      { label: 'Expirado',      cor: 'red',     ordem: 1, descricao: 'Validade terminada — recertificar' },
  a_expirar:     { label: 'A expirar',     cor: 'amber',   ordem: 2, descricao: `Expira nos próximos ${DIAS_AVISO_EXPIRACAO} dias` },
  atrasado:      { label: 'Atrasado',      cor: 'amber',   ordem: 3, descricao: 'Em curso, prazo de conclusão ultrapassado' },
  em_curso:      { label: 'Em curso',      cor: 'blue',    ordem: 4, descricao: 'Inscrito, por concluir' },
  valido:        { label: 'Válido',        cor: 'emerald', ordem: 5, descricao: 'Concluído e dentro da validade' },
  concluido:     { label: 'Concluído',     cor: 'emerald', ordem: 6, descricao: 'Concluído (sem validade definida)' },
  nao_inscrito:  { label: 'Não inscrito',  cor: 'slate',   ordem: 7, descricao: 'Opcional, sem inscrição' },
};

export function diasAte(data, hoje = new Date()) {
  if (!data) return null;
  const d = new Date(data); if (Number.isNaN(d.getTime())) return null;
  const a = new Date(hoje); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}

export function somarMeses(data, meses) {
  if (!data || !meses) return null;
  const d = new Date(data); if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + Number(meses));
  return d.toISOString();
}

const lower = (s) => String(s || '').toLowerCase();
const intersecta = (a = [], b = []) => { const s = new Set((a || []).map(lower)); return (b || []).some(x => s.has(lower(x))); };

// O curso é obrigatório para este utilizador? (directo ou via trilha obrigatória que o inclua)
export function cursoObrigatorioPara(curso, user, { trilhas = [], trilhaCursos = [] } = {}) {
  if (!curso || !user) return false;
  const perfis = Array.isArray(user.perfis) ? user.perfis : [];
  if (curso.obrigatorio_todos) return true;
  if (intersecta(curso.obrigatorio_perfis, perfis)) return true;
  for (const tc of trilhaCursos) {
    if (tc.curso_id !== curso.id || tc.obrigatorio === false) continue;
    const t = trilhas.find(x => x.id === tc.trilha_id);
    if (!t || t.deleted_at || t.publicado === false) continue;
    if (t.obrigatorio_todos || intersecta(t.obrigatorio_perfis, perfis)) return true;
  }
  return false;
}

// Estado de uma conclusão (matrícula concluída ou formação externa aprovada) face à validade.
function estadoConclusao(validoAte, hoje) {
  if (validoAte) {
    const dias = diasAte(validoAte, hoje);
    if (dias < 0) return { estado: 'expirado', dias, validoAte };
    if (dias <= DIAS_AVISO_EXPIRACAO) return { estado: 'a_expirar', dias, validoAte };
    return { estado: 'valido', dias, validoAte };
  }
  return { estado: 'concluido', dias: null, validoAte: null };
}

// Formação externa "equivalente" a este curso (aprovada, não apagada) → validade efectiva.
export function validadeExterna(curso, ext) {
  if (!ext || ext.deleted_at || (ext.resultado && ext.resultado !== 'aprovado')) return undefined;
  return ext.valido_ate || (curso?.validade_meses && ext.data_realizacao ? somarMeses(ext.data_realizacao, curso.validade_meses) : null);
}

// Estado de um par curso × matrícula (matrícula pode ser null), considerando formação externa equivalente
// e refrescamentos concluídos (matrículas em cursos de tipo 'refrescamento' cujo curso_base_id é este curso).
// Devolve { estado, dias, validoAte, origem: 'matricula'|'externa'|'refrescamento'|null, externa, refrescamento }.
export function estadoFormacao(curso, matricula, { obrigatorio = false, hoje = new Date(), externas = [], refrescamentos = [] } = {}) {
  const candidatos = [];
  const m = matricula && matricula.estado !== 'cancelado' ? matricula : null;
  if (m && m.estado === 'concluido') candidatos.push({ ...estadoConclusao(m.valido_ate || null, hoje), origem: 'matricula', externa: null, refrescamento: null });
  for (const r of refrescamentos || []) {
    if (!r || r.estado !== 'concluido') continue;
    candidatos.push({ ...estadoConclusao(r.valido_ate || null, hoje), origem: 'refrescamento', externa: null, refrescamento: r });
  }
  for (const ext of externas || []) {
    if (!curso || ext.curso_id !== curso.id) continue;
    const v = validadeExterna(curso, ext);
    if (v === undefined) continue;
    candidatos.push({ ...estadoConclusao(v, hoje), origem: 'externa', externa: ext, refrescamento: null });
  }
  const melhor = (lista) => lista.sort((a, b) => (ESTADOS[b.estado].ordem - ESTADOS[a.estado].ordem) || (new Date(b.validoAte || 0) - new Date(a.validoAte || 0)) || (a.origem === 'matricula' ? -1 : 1))[0];
  const vigentes = candidatos.filter(c => c.estado === 'valido' || c.estado === 'concluido' || c.estado === 'a_expirar');
  if (vigentes.length) return melhor(vigentes);
  const emCurso = (mm, o) => {
    if (curso?.prazo_dias && mm.created_date) {
      const limite = new Date(mm.reaberta_em || mm.created_date);
      limite.setDate(limite.getDate() + Number(curso.prazo_dias));
      const dias = diasAte(limite, hoje);
      return { estado: dias < 0 ? 'atrasado' : 'em_curso', dias, validoAte: null, origem: o, externa: null, refrescamento: o === 'refrescamento' ? mm : null };
    }
    return { estado: 'em_curso', dias: null, validoAte: null, origem: o, externa: null, refrescamento: o === 'refrescamento' ? mm : null };
  };
  if (m && m.estado === 'ativo') return emCurso(m, 'matricula'); // em curso (eventualmente a recertificar depois de uma conclusão expirada)
  const refActivo = (refrescamentos || []).find(r => r && r.estado === 'ativo');
  if (refActivo) return emCurso(refActivo, 'refrescamento');       // a fazer o refrescamento
  if (candidatos.length) return melhor(candidatos); // só expirados
  return { estado: obrigatorio ? 'em_falta' : 'nao_inscrito', dias: null, validoAte: null, origem: null, externa: null, refrescamento: null };
}

// Cursos que são refrescamento de um curso base (publicados, não apagados).
export function refrescamentosDe(cursoBaseId, cursos = []) {
  return (cursos || []).filter(c => c && c.tipo_formacao === 'refrescamento' && c.curso_base_id === cursoBaseId && !c.deleted_at);
}

// Matriz completa: utilizadores × cursos. Colunas = cursos de formação inicial; os refrescamentos não são
// colunas próprias: as suas matrículas contam para o curso base. Formação externa equivalente conta como conclusão.
export function matrizFormacao({ users = [], cursos = [], matriculas = [], trilhas = [], trilhaCursos = [], externas = [], hoje = new Date() }) {
  const colunas = cursos.filter(c => c.tipo_formacao !== 'refrescamento');
  const refPorBase = new Map(); // baseId -> [ids de cursos de refrescamento]
  for (const c of cursos) if (c.tipo_formacao === 'refrescamento' && c.curso_base_id) { if (!refPorBase.has(c.curso_base_id)) refPorBase.set(c.curso_base_id, []); refPorBase.get(c.curso_base_id).push(c.id); }
  const porChave = new Map(matriculas.map(m => [`${m.curso_id}|${lower(m.aluno_email)}`, m]));
  const extPorAluno = new Map();
  for (const e of externas || []) { if (e.deleted_at) continue; const k = lower(e.aluno_email); if (!extPorAluno.has(k)) extPorAluno.set(k, []); extPorAluno.get(k).push(e); }
  const linhas = users.map(u => {
    const minhasExt = extPorAluno.get(lower(u.email)) || [];
    const celulas = colunas.map(c => {
      const obrigatorio = cursoObrigatorioPara(c, u, { trilhas, trilhaCursos });
      const m = porChave.get(`${c.id}|${lower(u.email)}`) || null;
      const refs = (refPorBase.get(c.id) || []).map(rid => porChave.get(`${rid}|${lower(u.email)}`)).filter(Boolean);
      const e = estadoFormacao(c, m, { obrigatorio, hoje, externas: minhasExt, refrescamentos: refs });
      return { curso: c, matricula: m, obrigatorio, ...e };
    });
    const resumo = {};
    for (const cel of celulas) resumo[cel.estado] = (resumo[cel.estado] || 0) + 1;
    const pendencias = celulas.filter(c => ['em_falta', 'expirado', 'a_expirar', 'atrasado'].includes(c.estado)).length;
    return { user: u, celulas, resumo, pendencias, externas: minhasExt.length };
  });
  const porCurso = colunas.map((c, i) => {
    const cont = {};
    for (const l of linhas) { const e = l.celulas[i].estado; cont[e] = (cont[e] || 0) + 1; }
    const obrigatorioPara = linhas.filter(l => l.celulas[i].obrigatorio).length;
    return { curso: c, contagens: cont, obrigatorioPara };
  });
  const totais = {};
  for (const l of linhas) for (const cel of l.celulas) totais[cel.estado] = (totais[cel.estado] || 0) + 1;
  return { linhas, porCurso, totais };
}

// Lista de alertas (para email/relatório): cada item = { tipo, user, curso, matricula, dias }
export function alertasFormacao(matriz) {
  const out = { em_falta: [], expirado: [], a_expirar: [], atrasado: [] };
  for (const l of matriz.linhas) for (const cel of l.celulas) {
    if (out[cel.estado]) out[cel.estado].push({ user: l.user, curso: cel.curso, matricula: cel.matricula, dias: cel.dias, validoAte: cel.validoAte, origem: cel.origem });
  }
  out.a_expirar.sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  out.expirado.sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  return out;
}
