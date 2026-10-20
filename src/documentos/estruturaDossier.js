// Estrutura dos dossiers entregues à ANAC — MOA e PSA — como VISTA de navegação na Biblioteca.
// Não mexe nas pastas (Setor → Classe), nem nos números, versões ou acessos: só diz em que secção do dossier
// (Manual / Anexos / Apêndices) cada documento aparece.
//
// A secção vem de `documento.estrutura_ref` (migr 178; ex. «MOA:AP.13», «PSA:AN.02») quando está preenchida —
// é o que vinha no nome do ficheiro entregue, ou o que a gestão escolheu — e, quando não está, das regras abaixo.
// Regra do dono (15/10/2026): formulários e fichas vão SEMPRE para o AP.13 do MOA.
//
// Réplicas (19/10/2026): um documento pode aparecer em mais do que uma secção sem deixar de ser UM documento — o mapa
// de quadrícula vive no PEA (MOA:AP.03) e é anexo do PCA (PSA:AP.01). Guarda-se «MOA:AP.03;PSA:AP.01»: a primeira é a
// casa do documento, as seguintes são réplicas. Uma revisão feita na casa vale em todas.

export const ESTRUTURAS = {
  MOA: {
    nome: 'Manual de Operações do Aeródromo (MOA)',
    grupos: [
      { chave: 'manual', nome: '01 · Manual', seccoes: [{ ref: '01', nome: 'Manual de Operações do Aeródromo' }] },
      { chave: 'anexos', nome: '02 · Anexos', seccoes: [
        { ref: 'AN.05', nome: 'Currículos dos gestores' },
        { ref: 'AN.07', nome: 'Acordos' },
      ] },
      { chave: 'apendices', nome: '03 · Apêndices', seccoes: [
        { ref: 'AP.02', nome: 'Cartas e Mapas' },
        { ref: 'AP.03', nome: 'PEA — Plano de Emergência' },
        { ref: 'AP.04', nome: 'PSCI — Salvamento e Combate a Incêndio' },
        { ref: 'AP.05', nome: 'PMAM — Manutenção' },
        { ref: 'AP.06', nome: 'PGRF — Risco de Fauna' },
        { ref: 'AP.07', nome: 'PBZPA — Zona de Protecção' },
        { ref: 'AP.08', nome: 'PRAFS — Remoção de Aeronave' },
        { ref: 'AP.09', nome: 'SMGCS' },
        { ref: 'AP.10', nome: 'MSGSO — Segurança Operacional' },
        { ref: 'AP.11', nome: 'PFOA — Formação do Operador' },
        { ref: 'AP.12', nome: 'RST — Segurança de Pista' },
        { ref: 'AP.13', nome: 'Formulários e Fichas' },
        { ref: 'AP.14', nome: 'Listas' },
        { ref: 'AP.15', nome: 'Outros' },
      ] },
    ],
  },
  PSA: {
    nome: 'Programa de Segurança do Aeroporto (PSA)',
    restrito: true, // só documentos AVSEC: a parede (migr 173/175) já os esconde a quem não está credenciado
    grupos: [
      { chave: 'programa', nome: '01 · Programa', seccoes: [{ ref: '01', nome: 'Programa de Segurança do Aeroporto' }] },
      { chave: 'anexos', nome: 'AN · Anexos', seccoes: [
        { ref: 'AN.01', nome: 'Listas' },
        { ref: 'AN.02', nome: 'POPs' },
        { ref: 'AN.03', nome: 'Registos' },
        { ref: 'AN.04', nome: 'Plantas Técnicas' },
      ] },
      { chave: 'apendices', nome: 'AP · Apêndices', seccoes: [
        { ref: 'AP.01', nome: 'PCA — Plano de Contingência' },
        { ref: 'AP.02', nome: 'PFTSAC — Formação e Treino AVSEC' },
        { ref: 'AP.03', nome: 'PCQAC — Controlo de Qualidade AVSEC' },
        { ref: 'AP.04', nome: 'Outros' },
      ] },
    ],
  },
};

// manual (3.º segmento do número) → apêndice do MOA
const AP_MOA_POR_PROCESSO = {
  PEA: 'AP.03', PSCI: 'AP.04', PCBA: 'AP.04', PTRBA: 'AP.04',
  PMA: 'AP.05', PMB: 'AP.05', PME: 'AP.05', PMP: 'AP.05', PGG: 'AP.05',
  PGRF: 'AP.06', PBZPA: 'AP.07', PRAFS: 'AP.08', SMGCS: 'AP.09', MGSO: 'AP.10',
  PFOA: 'AP.11', RST: 'AP.12',
};
const PROCESSOS_PSA = new Set(['PSA', 'PCA', 'PFT', 'AVSEC']);
const CLASSES_CARTAS = new Set(['MP', 'MQ', 'CR', 'CRO', 'PT']);
const CLASSES_FORM = new Set(['FR', 'FTO']);

const partes = (numero) => {
  const m = String(numero || '').match(/^([A-Z]{2,4})-([A-Z]{4})-([A-Z]{2,6})-(\d{3})$/);
  return m ? { classe: m[1], processo: m[3], seq: m[4] } : null;
};

// Secção calculada pelas regras: devolve «MOA:AP.13», «PSA:AN.02», …
export function seccaoPorRegra(doc) {
  const p = partes(doc?.numero) || {};
  const classe = doc?.classe_codigo || p.classe || '';
  const processo = doc?.processo_codigo || p.processo || '';
  const titulo = String(doc?.titulo || '');

  if (PROCESSOS_PSA.has(processo)) {
    if (processo === 'PCA') return 'PSA:AP.01';
    if (processo === 'PFT') return 'PSA:AP.02';
    if (/conting[eê]ncia/i.test(titulo)) return 'PSA:AP.01';
    if (classe === 'PR' && p.seq === '001') return 'PSA:01';
    if (/controlo de qualidade/i.test(titulo)) return 'PSA:AP.03';
    if (classe === 'LT') return 'PSA:AN.01';
    if (classe === 'POP') return 'PSA:AN.02';
    if (CLASSES_FORM.has(classe)) return 'PSA:AN.03';
    if (CLASSES_CARTAS.has(classe)) return 'PSA:AN.04';
    return 'PSA:AP.04';
  }
  if (classe === 'MA' && processo === 'MOA') return 'MOA:01';
  if (CLASSES_FORM.has(classe)) return 'MOA:AP.13';
  if (classe === 'LT') return 'MOA:AP.14';
  // AN.05: currículos dos gestores e as respectivas nomeações
  // (sem acentos: títulos vindos de zips trazem os acentos decompostos — «NOMEAÇÃO» em NFD não casa com [çã])
  const tituloSimples = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (classe === 'DO' && /^\s*(cv\b|curricul|nomeacao|nomecao|oficio de nomea)/i.test(tituloSimples)) return 'MOA:AN.05';
  if (classe === 'DO' && processo === 'MOA' && /acordo|protocolo|memorando|\bvs\b/i.test(titulo)) return 'MOA:AN.07';
  if (AP_MOA_POR_PROCESSO[processo]) return `MOA:${AP_MOA_POR_PROCESSO[processo]}`;
  if (CLASSES_CARTAS.has(classe)) return 'MOA:AP.02';
  return 'MOA:AP.15';
}

// A secção efectiva (a casa do documento): a primeira guardada (se válida) ou a da regra. Formulários: sempre AP.13
// do MOA (regra do dono), salvo PSA.
export function seccaoDoDocumento(doc) {
  const guardada = String(doc?.estrutura_ref || '').split(';')[0].trim();
  if (guardada && refValida(guardada)) {
    const p = partes(doc?.numero) || {};
    const classe = doc?.classe_codigo || p.classe;
    if (CLASSES_FORM.has(classe) && guardada.startsWith('MOA:')) return 'MOA:AP.13';
    return guardada;
  }
  return seccaoPorRegra(doc);
}

// Todas as secções onde o documento aparece: a casa primeiro, depois as réplicas válidas (sem repetidos).
export function seccoesDoDocumento(doc) {
  const casa = seccaoDoDocumento(doc);
  const replicas = String(doc?.estrutura_ref || '').split(';').slice(1).map(x => x.trim()).filter(x => x && x !== casa && refValida(x));
  return [casa, ...new Set(replicas)];
}

export function refValida(ref) {
  const [dossier, sec] = String(ref || '').split(':');
  const e = ESTRUTURAS[dossier];
  return !!e && e.grupos.some(g => g.seccoes.some(s => s.ref === sec));
}

export function nomeSeccao(ref) {
  const [dossier, sec] = String(ref || '').split(':');
  const e = ESTRUTURAS[dossier]; if (!e) return ref;
  for (const g of e.grupos) for (const s of g.seccoes) if (s.ref === sec) return `${sec === '01' ? '' : sec + ' · '}${s.nome}`;
  return ref;
}

// Referência AN/AP no nome do ficheiro entregue (ex. «AP.04.033 # …», «AN.07-006 # …») → «AP.04».
export function refDoNomeOriginal(nome) {
  const m = String(nome || '').match(/\b(AN|AP)\s*[.\- ]?\s*(\d{1,2})(?=[\s.\-#_]|$)/i);
  return m ? `${m[1].toUpperCase()}.${String(m[2]).padStart(2, '0')}` : null;
}
