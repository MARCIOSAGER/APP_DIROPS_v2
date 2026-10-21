// Dados do editor estruturado («Redigir documentos»): modelos (documento_modelo), rascunhos
// (documento_rascunho_estruturado, migração tools/ged-edicao/182_documento_estruturado.sql) e o «Gerar rascunho»,
// que cria o documento (se for novo), gera PDF + DOCX e grava uma versão em RASCUNHO pelo fluxo normal
// (criarVersaoRascunho) — nada entra em vigor sem aprovação.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { auditarDocs } from '../hooks';
import { criarVersaoRascunho } from '../hooksEdicao';
import { MODELOS_PADRAO } from './modelosPadrao';
import { validarDocumentoEstruturado } from './contrato';
import { prepararParaGerar, nomeBaseFicheiro, rotuloVersao, notaVersao, extrasDe, iniciarRevisao } from './assistente';

const T_RASC = 'documento_rascunho_estruturado';
const COLS_LISTA = 'id,documento_id,modelo,titulo,numero,revisao,aeroporto_id,criado_por,criado_em,actualizado_em,actualizado_por,estado,versao_gerada_id,gerado_em';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const naLista = (d) => (Array.isArray(d) ? d : []);

/** A tabela ainda não existe (migração 182 por correr) → mensagem própria em vez do erro cru. */
export function tabelaEmFalta(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|PGRST205|PGRST202|does not exist|Could not find the table/i.test(t);
}

export function erroEstruturado(error, acao) {
  if (tabelaEmFalta(error)) {
    return new Error('O editor de documentos ainda não está activo no servidor: falta correr a migração 182 (tools/ged-edicao/182_documento_estruturado.sql).');
  }
  const msg = String(error?.message || error || '');
  if (/row-level security|permission denied|42501/i.test(msg)) return new Error(`Sem permissão para ${acao}. Só editores e gestores do aeroporto do documento podem redigir.`);
  if (/documento_rascunho_estruturado_doc_uk|duplicate key/i.test(msg)) return new Error('Este documento já tem um rascunho no editor. Abra-o na lista «Redigir documentos».');
  return new Error(`Não foi possível ${acao}: ${msg || 'erro desconhecido'}.`);
}

// ── modelos ─────────────────────────────────────────────────────────────────
// Da tabela; sem tabela (ou vazia) usa os modelos padrão do código, para o assistente funcionar na mesma.
export function useModelosDocumento() {
  return useQuery({
    queryKey: ['gd', 'edicao', 'modelos'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_modelo').select('*').eq('activo', true).order('ordem');
      if (error || !naLista(data).length) return { modelos: MODELOS_PADRAO.map(m => ({ ...m, id: null, activo: true })), daTabela: false };
      return { modelos: naLista(data), daTabela: true };
    },
  });
}

// ── rascunhos ───────────────────────────────────────────────────────────────
export function useRascunhosEstruturados() {
  return useQuery({
    queryKey: ['gd', 'edicao', 'rascunhos'],
    staleTime: 30 * 1000,
    retry: (n, e) => !tabelaEmFalta(e) && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.from(T_RASC).select(COLS_LISTA).order('actualizado_em', { ascending: false }).limit(500);
      if (error) throw erroEstruturado(error, 'carregar os rascunhos');
      return naLista(data);
    },
  });
}

export function useRascunhoEstruturado(id) {
  return useQuery({
    queryKey: ['gd', 'edicao', 'rascunho', id],
    enabled: !!id && id !== 'novo',
    gcTime: 0,
    staleTime: Infinity, // o assistente é que manda no estado enquanto está aberto
    refetchOnWindowFocus: false,
    retry: (n, e) => !tabelaEmFalta(e) && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.from(T_RASC).select('*').eq('id', id).maybeSingle();
      if (error) throw erroEstruturado(error, 'abrir o rascunho');
      return data;
    },
  });
}

/** Rascunho estruturado ligado a um documento (para «Rever com o editor» a partir do documento). */
export async function rascunhoDoDocumento(documentoId) {
  const { data, error } = await supabase.from(T_RASC).select(COLS_LISTA).eq('documento_id', documentoId).maybeSingle();
  if (error) throw erroEstruturado(error, 'procurar o rascunho do documento');
  return data || null;
}

/** Revisor e aprovador escolhidos no cabeçalho do editor (para pré-preencher o «Pedir aprovação»). */
export async function signatariosDoRascunho(documentoId) {
  const { data, error } = await supabase.from(T_RASC).select('conteudo').eq('documento_id', documentoId).maybeSingle();
  if (error || !data) return null;
  const ex = extrasDe(data.conteudo);
  return { verificadoEmail: ex.verificadoEmail || null, aprovadoEmail: ex.aprovadoEmail || null };
}

export function useRecarregarRascunhos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'edicao'] });
}

export async function criarRascunhoEstruturado({ conteudo, aeroportoId, documentoId = null, modeloId = null }, actor) {
  const { data, error } = await supabase.from(T_RASC).insert({
    documento_id: documentoId, modelo: conteudo.modelo, modelo_id: modeloId, conteudo,
    aeroporto_id: aeroportoId || null, criado_por: String(actor?.email || '').toLowerCase(), estado: 'em_edicao',
  }).select('*').single();
  if (error) throw erroEstruturado(error, 'criar o rascunho');
  return data;
}

export async function guardarRascunhoEstruturado(id, { conteudo, aeroportoId }) {
  const v = validarDocumentoEstruturado(conteudo);
  if (!v.valido) throw new Error(`O conteúdo não respeita o modelo: ${v.erros.slice(0, 3).join('; ')}`);
  const patch = { conteudo };
  if (aeroportoId !== undefined) patch.aeroporto_id = aeroportoId || null;
  const { data, error } = await supabase.from(T_RASC).update(patch).eq('id', id).select('id,actualizado_em').maybeSingle();
  if (error) throw erroEstruturado(error, 'gravar o rascunho');
  if (!data) throw new Error('O rascunho já não existe ou deixou de ter permissão para o alterar.');
  return data;
}

export async function apagarRascunhoEstruturado(id) {
  const { error } = await supabase.from(T_RASC).delete().eq('id', id);
  if (error) throw erroEstruturado(error, 'apagar o rascunho');
}

/** «Rever»: reabre um rascunho já gerado com a revisão seguinte e uma entrada nova no histórico. */
export async function reverRascunhoEstruturado(rascunho, { descricao, autor }, actor) {
  let r = rascunho;
  if (!r?.conteudo) {
    const { data, error } = await supabase.from(T_RASC).select('*').eq('id', rascunho.id).maybeSingle();
    if (error) throw erroEstruturado(error, 'abrir o rascunho');
    r = data;
  }
  const conteudo = iniciarRevisao(r, { descricao, autor });
  const { error } = await supabase.from(T_RASC).update({ conteudo, estado: 'em_edicao' }).eq('id', r.id);
  if (error) throw erroEstruturado(error, 'abrir a revisão');
  await auditarDocs(actor, { acao: 'documento_revisao_editor', id: r.documento_id, detalhes: `Revisão ${conteudo.cabecalho.revisao} aberta no editor: ${descricao || ''}` });
  return { ...r, conteudo, estado: 'em_edicao' };
}

// ── gerar ───────────────────────────────────────────────────────────────────
async function geradores() {
  const [pdf, docx] = await Promise.all([import('./gerarPdfEstruturado.js'), import('./gerarDocxEstruturado.js')]);
  return { gerarPdf: pdf.gerarPdf, gerarDocx: docx.gerarDocx };
}

/** Só o PDF, para pré-visualizar (não grava nada). */
export async function preverPdf(conteudo) {
  const { gerarPdf } = await geradores();
  return gerarPdf(conteudo, { previsualizacao: true });
}

/**
 * Gera a revisão em rascunho:
 *  1. valida (estrito); 2. documento novo → cria o registo `documento` em rascunho (como a Gestão › Documentos) e
 *  liga-o ao rascunho estruturado; 3. gera PDF + DOCX; 4. criarVersaoRascunho (PDF = revisão, DOCX = fonte);
 *  5. marca o rascunho estruturado como 'gerado' com a versão e o conteúdo que lhe deu origem.
 * Devolve { documentoId, versao, rascunho }.
 */
export async function gerarRascunhoDocumento({ rascunho, conteudo: conteudoIn, aeroportoId }, actor, onProgresso) {
  const passo = (t) => { try { onProgresso?.(t); } catch { /* */ } };
  const conteudo = prepararParaGerar(conteudoIn, { autor: actor?.full_name || actor?.email || '' });
  const v = validarDocumentoEstruturado(conteudo, { estrito: true });
  if (!v.valido) throw new Error(v.erros.join('\n'));
  const extras = extrasDe(conteudo);

  passo('A gravar o rascunho…');
  await guardarRascunhoEstruturado(rascunho.id, { conteudo, aeroportoId });

  let documentoId = rascunho.documento_id || null;
  if (!documentoId) {
    if (!extras.processo) throw new Error('Escolha o manual ou programa (processo) no cabeçalho.');
    passo('A criar o documento em rascunho…');
    const c = conteudo.cabecalho;
    const agora = new Date().toISOString();
    // versao_atual 0: a primeira revisão gerada fica com o número 1 (criarVersaoRascunho usa o maior + 1)
    const { data, error } = await supabase.from('documento').insert({
      titulo: c.titulo.trim(),
      numero: c.numero.trim() || null,
      classe_codigo: conteudo.modelo,
      processo_codigo: extras.processo,
      aeroporto_id: aeroportoId || null,
      pasta_id: extras.pastaId || null,
      responsavel_email: String(actor?.email || '').toLowerCase() || null,
      estado: 'rascunho', versao: '0', versao_atual: 0,
      created_by: actor?.email || null, created_date: agora, updated_date: agora,
    }).select('id,titulo').single();
    if (error) {
      if (/duplicate key|23505/.test(`${error.code} ${error.message}`)) throw new Error(`Já existe um documento com o número ${c.numero}. Use a sugestão do número seguinte.`);
      throw erroEstruturado(error, 'criar o documento');
    }
    documentoId = data.id;
    const conteudoLigado = { ...conteudo, extras: { ...extras, documentoId } };
    const { error: eL } = await supabase.from('documento_rascunho_estruturado').update({ documento_id: documentoId, conteudo: conteudoLigado }).eq('id', rascunho.id);
    if (eL) throw erroEstruturado(eL, 'ligar o rascunho ao documento');
    await auditarDocs(actor, { acao: 'documento_criado', id: documentoId, detalhes: `Documento criado no editor: ${data.titulo}` });
  }

  passo('A gerar o PDF e o Word…');
  const { gerarPdf, gerarDocx } = await geradores();
  const [pdf, docx] = await Promise.all([gerarPdf(conteudo, {}), gerarDocx(conteudo, {})]);

  passo('A gravar a revisão em rascunho…');
  const base = nomeBaseFicheiro(conteudo);
  const linhas = await criarVersaoRascunho({
    documentoId,
    ficheiros: [
      { blob: pdf, nome: `${base}.pdf`, mime: 'application/pdf', papel: 'pdf' },
      { blob: docx, nome: `${base}.docx`, mime: MIME_DOCX, papel: 'fonte' },
    ],
    rotulo: rotuloVersao(conteudo),
    nota: notaVersao(conteudo),
    onProgresso: (f) => passo(f.startsWith('enviar:') ? `A enviar ${f.slice(7)}…` : f === 'registar' ? 'A registar a revisão…' : 'A verificar…'),
  });
  const versao = linhas[0] || null;

  const final = { ...conteudo, extras: { ...extrasDe(conteudo), documentoId } };
  const { error: eG } = await supabase.from('documento_rascunho_estruturado').update({
    conteudo: final, conteudo_gerado: final, estado: 'gerado', versao_gerada_id: versao?.id || null, gerado_em: new Date().toISOString(),
  }).eq('id', rascunho.id);
  if (eG) throw erroEstruturado(eG, 'marcar o rascunho como gerado');
  await auditarDocs(actor, { acao: 'documento_redigido', id: documentoId, detalhes: `${rotuloVersao(conteudo)} gerada no editor (versão ${versao?.versao ?? '?'} em rascunho)` });
  return { documentoId, versao, conteudo: final };
}
