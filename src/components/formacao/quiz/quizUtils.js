// Utilitários do quiz no frontend (espelham as regras do motor lms-quiz.js do servidor).
import { CircleDot, CheckSquare, ToggleLeft, TextCursorInput, Hash, ListOrdered, GitCompare, MousePointerClick, Tags, MessageSquareText } from 'lucide-react';

export const TIPOS_PERGUNTA = {
  escolha_unica: { label: 'Escolha única', icon: CircleDot, ajuda: 'Várias opções, uma correcta.' },
  escolha_multipla: { label: 'Escolha múltipla', icon: CheckSquare, ajuda: 'Várias correctas; pontuação parcial (certas menos erradas).' },
  vf: { label: 'Verdadeiro / Falso', icon: ToggleLeft, ajuda: 'Afirmação a classificar.' },
  lacuna: { label: 'Preencher a lacuna', icon: TextCursorInput, ajuda: 'Resposta curta; aceita várias respostas, sem distinguir maiúsculas ou acentos.' },
  numerica: { label: 'Resposta numérica', icon: Hash, ajuda: 'Valor com tolerância (ex.: 25 ± 0).' },
  ordenacao: { label: 'Ordenação', icon: ListOrdered, ajuda: 'Colocar itens pela ordem correcta; pontuação parcial por posição.' },
  correspondencia: { label: 'Correspondência', icon: GitCompare, ajuda: 'Ligar pares (termo ↔ definição); pontuação parcial por par.' },
  hotspot: { label: 'Ponto na imagem', icon: MousePointerClick, ajuda: 'O aluno clica no sítio certo de uma imagem (uma ou mais zonas correctas).', imagem: true },
  rotulos: { label: 'Rótulos na imagem', icon: Tags, ajuda: 'O aluno associa rótulos a zonas de uma imagem; pontuação parcial por zona.', imagem: true },
  aberta: { label: 'Resposta aberta', icon: MessageSquareText, ajuda: 'Texto livre corrigido manualmente pelo instrutor; a nota fica pendente até à correcção.', manual: true },
};

export const novoId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

// Opções iniciais por tipo, para o formulário.
export function opcoesIniciais(tipo) {
  switch (tipo) {
    case 'vf': return [{ id: 'v', texto: 'Verdadeiro', correta: true }, { id: 'f', texto: 'Falso', correta: false }];
    case 'escolha_unica': case 'escolha_multipla': return [{ id: novoId(), texto: '', correta: true }, { id: novoId(), texto: '', correta: false }, { id: novoId(), texto: '', correta: false }];
    case 'lacuna': return [{ id: novoId(), texto: '' }];
    case 'numerica': return [{ valor: '', tolerancia: 0, unidade: '' }];
    case 'ordenacao': return [{ id: novoId(), texto: '' }, { id: novoId(), texto: '' }, { id: novoId(), texto: '' }];
    case 'correspondencia': return [{ id: novoId(), esquerda: '', direita: '' }, { id: novoId(), esquerda: '', direita: '' }];
    case 'hotspot': case 'rotulos': return [];
    case 'aberta': return [{ max_chars: 1000, rubrica: '' }];
    default: return [];
  }
}

// Mesmas regras do servidor (lms-quiz.validarPergunta), com mensagens para o formulário.
export function validarPergunta(p) {
  const erros = [];
  if (!p || !TIPOS_PERGUNTA[p.tipo]) erros.push('Escolha o tipo de pergunta.');
  if (!p || !String(p.enunciado || '').trim()) erros.push('Escreva o enunciado.');
  if (p && TIPOS_PERGUNTA[p.tipo]?.imagem && !String(p.imagem_url || '').trim()) erros.push('Carregue a imagem sobre a qual o aluno vai responder.');
  const ops = (p && Array.isArray(p.opcoes) ? p.opcoes : []);
  const cheias = ops.filter(o => String(o.texto ?? o.esquerda ?? '').trim());
  switch (p && p.tipo) {
    case 'escolha_unica':
      if (cheias.length < 2) erros.push('Escreva pelo menos 2 opções.');
      if (cheias.filter(o => o.correta).length !== 1) erros.push('Marque exactamente 1 opção correcta.');
      break;
    case 'vf':
      if (ops.filter(o => o.correta).length !== 1) erros.push('Marque Verdadeiro ou Falso como correcto.');
      break;
    case 'escolha_multipla':
      if (cheias.length < 2) erros.push('Escreva pelo menos 2 opções.');
      if (!cheias.some(o => o.correta)) erros.push('Marque pelo menos 1 opção correcta.');
      break;
    case 'lacuna':
      if (!cheias.length) erros.push('Indique pelo menos 1 resposta aceite.');
      break;
    case 'numerica':
      if (!ops[0] || !Number.isFinite(Number(String(ops[0].valor).replace(',', '.')))) erros.push('Indique o valor correcto.');
      break;
    case 'ordenacao':
      if (cheias.length < 2) erros.push('Escreva pelo menos 2 itens para ordenar.');
      break;
    case 'correspondencia':
      if (ops.filter(o => String(o.esquerda || '').trim() && String(o.direita || '').trim()).length < 2) erros.push('Escreva pelo menos 2 pares completos.');
      break;
    case 'hotspot':
      if (ops.length < 1) erros.push('Desenhe pelo menos 1 zona correcta sobre a imagem.');
      break;
    case 'rotulos':
      if (ops.filter(o => String(o.rotulo || '').trim()).length < 2) erros.push('Desenhe pelo menos 2 zonas e dê um rótulo a cada uma.');
      break;
    case 'aberta': break;
    default: break;
  }
  return erros;
}

const r1 = (v) => Math.round(Number(v) * 10) / 10;
const zonaLimpa = (z) => ({ id: z.id || novoId(), x: Math.max(0, Math.min(100, r1(z.x))), y: Math.max(0, Math.min(100, r1(z.y))), w: Math.max(0, r1(z.w)), h: Math.max(0, r1(z.h)) });

// Limpa opções vazias e normaliza antes de gravar.
export function normalizarOpcoes(tipo, opcoes) {
  const ops = Array.isArray(opcoes) ? opcoes : [];
  switch (tipo) {
    case 'numerica': {
      const o = ops[0] || {};
      return [{ valor: Number(String(o.valor).replace(',', '.')), tolerancia: Number(String(o.tolerancia || 0).replace(',', '.')) || 0, unidade: String(o.unidade || '').trim() || undefined }];
    }
    case 'correspondencia':
      return ops.filter(o => String(o.esquerda || '').trim() && String(o.direita || '').trim()).map(o => ({ id: o.id || novoId(), esquerda: o.esquerda.trim(), direita: o.direita.trim() }));
    case 'lacuna': case 'ordenacao':
      return ops.filter(o => String(o.texto || '').trim()).map(o => ({ id: o.id || novoId(), texto: o.texto.trim() }));
    case 'vf':
      return ops.map(o => ({ id: o.id, texto: o.texto, correta: !!o.correta }));
    case 'hotspot':
      return ops.filter(z => Number(z.w) > 0 && Number(z.h) > 0).map(zonaLimpa);
    case 'rotulos':
      return ops.filter(z => Number(z.w) > 0 && Number(z.h) > 0 && String(z.rotulo || '').trim()).map(z => ({ ...zonaLimpa(z), rotulo: String(z.rotulo).trim() }));
    case 'aberta': {
      const o = ops[0] || {};
      const max = parseInt(o.max_chars, 10);
      return [{ max_chars: Number.isFinite(max) && max > 0 ? Math.min(max, 20000) : 1000, rubrica: String(o.rubrica || '').trim() || undefined }];
    }
    default:
      return ops.filter(o => String(o.texto || '').trim()).map(o => ({ id: o.id || novoId(), texto: o.texto.trim(), correta: !!o.correta, feedback: String(o.feedback || '').trim() || undefined }));
  }
}

// Coordenadas (%) de um evento de rato/ponteiro relativas a um elemento.
export function coordsPct(e, el) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { x: 0, y: 0 };
  return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
}

export function fmtTempo(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Resumo textual da composição (para listas).
export function resumoItens(itens = [], perguntasById = {}) {
  let n = 0, pontos = 0;
  for (const it of itens) {
    if (it.modo === 'aleatoria') { n += parseInt(it.quantidade || 1, 10) || 0; }
    else { n += 1; pontos += Number(perguntasById[it.pergunta_id]?.pontos) || 1; }
  }
  return { n, pontos };
}

// Texto legível de uma resposta (ou do gabarito) para a revisão. Aceita a pergunta
// como servida ao aluno (p.esquerda/p.direita/p.rotulos/p.zonas) ou como está no banco (p.opcoes).
export function descreverResposta(p, valor, gabarito = false) {
  if (!p || valor == null) return '';
  const ops = p.opcoes || [];
  const textoOp = (id) => ops.find(o => o.id === id)?.texto ?? id;
  switch (p.tipo) {
    case 'escolha_unica': case 'vf': return textoOp(valor);
    case 'escolha_multipla': return (Array.isArray(valor) ? valor : []).map(textoOp).join(', ');
    case 'lacuna': return Array.isArray(valor) ? valor.join(' / ') : String(valor);
    case 'numerica': return String(valor);
    case 'ordenacao': return (Array.isArray(valor) ? valor : []).map((id, i) => `${i + 1}. ${textoOp(id)}`).join('  ');
    case 'correspondencia': {
      const esq = Object.fromEntries((p.esquerda || ops).map(e => [e.id, e.texto ?? e.esquerda]));
      const dir = Object.fromEntries((p.direita || ops).map(d => [d.id, d.texto ?? d.direita]));
      return Object.entries(valor && typeof valor === 'object' ? valor : {}).map(([l, r]) => `${esq[l] ?? l} ↔ ${dir[r] ?? r}`).join('; ');
    }
    case 'hotspot': {
      if (gabarito) { const n = Array.isArray(valor) ? valor.length : 0; return n === 1 ? 'a zona assinalada na imagem' : `uma das ${n} zonas assinaladas na imagem`; }
      return valor && typeof valor === 'object' && Number.isFinite(Number(valor.x)) ? `ponto a ${Math.round(valor.x)}% / ${Math.round(valor.y)}% da imagem` : '';
    }
    case 'rotulos': {
      const v = valor && typeof valor === 'object' ? valor : {};
      const zonas = p.zonas || ops;
      const rot = Object.fromEntries((p.rotulos || []).map(r => [r.id, r.texto]));
      return zonas.map((z, i) => { const t = gabarito ? v[z.id] : (rot[v[z.id]] ?? (v[z.id] ? v[z.id] : null)); return t ? `Zona ${i + 1}: ${t}` : null; }).filter(Boolean).join('; ');
    }
    case 'aberta': return gabarito ? '' : String(valor);
    default: return String(valor);
  }
}
