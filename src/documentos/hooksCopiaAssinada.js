// Rubrica pessoal e cópia assinada (migração 186).
//
// Rubrica: imagem PNG da pessoa, guardada só por ela (doc_rubrica_guardar / doc_rubrica_minha). Aparece apenas nos
// documentos que ASSINOU no fluxo (doc_rubricas_da_versao devolve só os signatários da versão). A prova é a
// assinatura electrónica; a imagem é cosmética.
//
// Cópia assinada: gerarERegistarCopiaAssinada(versaoId) junta a versão, o documento, as assinaturas da vista, as
// rubricas e o PDF ORIGINAL selado; gera a cópia (do conteúdo do editor estruturado se a versão veio de lá e o
// PDF é o mesmo; senão por cima do ficheiro), calcula o sha256, carrega para private-uploads e regista-a
// (doc_copia_assinada_registar). Geradores em edicao/copiaAssinada.js (carregados a pedido: trazem o jsPDF).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, URL_BASE } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { enderecoAssinado } from '@/functions/obterUrlAssinadaDocumento';
import { impressaoDigital, auditarDocs } from './hooks';
import { lerFicheiros, lerAssinaturas, urlFicheiroFluxo } from './apiFluxo';
import {
  falta186, erro186, MENSAGEM_SEM_186, nomeCopiaAssinada, caminhoCopiaAssinada, pdfOriginalDaVersao,
  escolherModoCopia, rubricasPorEmail, linhasDaVersao, umaLinha, codigoDeSha,
} from './copiaAssinadaLogica';

export { MENSAGEM_SEM_186, falta186 } from './copiaAssinadaLogica';

const BUCKET = 'private-uploads';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const MIN = 60 * 1000;

// ── rubrica ─────────────────────────────────────────────────────────────────
export function useMinhaRubrica() {
  return useQuery({
    queryKey: ['gd', 'rubrica', 'minha'],
    staleTime: 5 * MIN,
    retry: (n, e) => !falta186(e) && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('doc_rubrica_minha');
      if (error) throw erro186(error, 'ler a sua rubrica');
      const l = umaLinha(data);
      return l?.imagem ? l : null;
    },
  });
}

export async function guardarRubrica(imagem) {
  const { error } = await supabase.rpc('doc_rubrica_guardar', { p_imagem: imagem || null });
  if (error) throw erro186(error, imagem ? 'guardar a rubrica' : 'remover a rubrica');
}

export function useRecarregarRubrica() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['gd', 'rubrica'] });
}

// ── cópia assinada: leitura ─────────────────────────────────────────────────
export async function lerCopiaAssinada(versaoId) {
  if (!versaoId) return null;
  const { data, error } = await supabase.rpc('doc_copia_assinada_da_versao', { p_versao: versaoId });
  if (error) throw erro186(error, 'ler a cópia assinada');
  // jsonb: {id, caminho, sha256, nome, tamanho, criado_em, criado_por, origem_sha256, codigo} ou null
  const l = umaLinha(data);
  if (!l?.caminho) return null;
  return { ...l, codigo: l.codigo || codigoDeSha(l.origem_sha256) };
}

export function useCopiaAssinada(versaoId) {
  return useQuery({
    queryKey: ['gd', 'copia-assinada', versaoId],
    enabled: !!versaoId,
    staleTime: MIN,
    retry: (n, e) => !falta186(e) && n < 2,
    queryFn: () => lerCopiaAssinada(versaoId),
  });
}

export function useRecarregarCopiaAssinada() {
  const qc = useQueryClient();
  return (versaoId) => qc.invalidateQueries({ queryKey: versaoId ? ['gd', 'copia-assinada', versaoId] : ['gd', 'copia-assinada'] });
}

// Endereço temporário da cópia (mesma rota de assinatura de chaves do balde privado que ficheiroVersao.js).
export async function urlCopiaAssinada(caminho, { validade_s = 300 } = {}) {
  const chave = String(caminho || '').replace(/^\//, '').replace(/^private-uploads\//, '');
  if (!chave) throw new Error('A cópia assinada não tem ficheiro associado.');
  let token = ANON;
  try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch { /* sem sessão */ }
  const r = await fetch(`${URL_BASE}/storage/v1/object/sign/${BUCKET}/${chave.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: validade_s }),
  });
  if (!r.ok) {
    if (r.status === 404 || r.status === 403 || r.status === 401) {
      throw new Error('A cópia assinada não está disponível para si, ou o servidor ainda não foi actualizado para a servir (migração 186 / reinício do serviço).');
    }
    throw new Error(`Não foi possível preparar a cópia assinada (${r.status}).`);
  }
  const j = await r.json().catch(() => ({}));
  const url = enderecoAssinado(j.signedURL || j.signedUrl || j.url);
  if (!url) throw new Error('O servidor não devolveu o endereço da cópia assinada.');
  return url;
}

/** Descarrega com o nome padrão (não o UUID do armazenamento): busca o ficheiro e entrega-o por <a download>. */
export async function descarregarCopiaAssinada(copia, nome) {
  const url = await urlCopiaAssinada(copia?.caminho);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não foi possível descarregar a cópia assinada (${r.status}).`);
  const blob = await r.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj;
  a.download = nome || copia?.nome || 'copia-assinada.pdf';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 30 * 1000);
}

// ── cópia assinada: geração ─────────────────────────────────────────────────
// Sempre pela rota do fluxo (o ficheiro exacto que foi assinado). NÃO se usa o endereço da versão: depois do
// patch 32 o servidor serve por lá a cópia assinada vigente, e carimbar uma cópia por cima de outra estragava-a.
// Confere-se a impressão digital do que chegou com a do original assinado.
async function obterPdfOriginal(ficheiro, shaOriginal) {
  const url = await urlFicheiroFluxo(ficheiro.id, { modo: 'descarregar' });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não foi possível obter o PDF original assinado (${r.status}).`);
  const buf = await r.arrayBuffer();
  const sha = await impressaoDigital(new Blob([buf]));
  if (sha && shaOriginal && sha !== shaOriginal) {
    throw new Error('O ficheiro recebido não é o PDF original assinado (a impressão digital não confere). Nada foi gerado.');
  }
  return buf;
}

async function lerRascunhoDaVersao(versaoId, documentoId) {
  // a tabela pode não existir (migração 182) ou não ser legível por este perfil: nesse caso, cópia a partir do ficheiro
  try {
    const { data, error } = await supabase.from('documento_rascunho_estruturado')
      .select('id,documento_id,versao_gerada_id,conteudo,conteudo_gerado')
      .eq('versao_gerada_id', versaoId).maybeSingle();
    if (!error && data) return data;
    if (documentoId) {
      const r2 = await supabase.from('documento_rascunho_estruturado')
        .select('id,documento_id,versao_gerada_id,conteudo,conteudo_gerado').eq('documento_id', documentoId).maybeSingle();
      if (!r2.error && r2.data) return r2.data;
    }
  } catch { /* sem editor estruturado */ }
  return null;
}

async function carregarLogoSga() {
  try {
    const { carregarLogo } = await import('./edicao/comum.js');
    return await carregarLogo({});
  } catch { return null; }
}

/**
 * Gera e regista a cópia assinada de uma versão aprovada. onProgresso(texto) é opcional.
 * Devolve { id, caminho, sha256, nome, codigo, modo }.
 */
export async function gerarERegistarCopiaAssinada(versaoId, { onProgresso, actor = null } = {}) {
  const passo = (t) => { try { onProgresso?.(t); } catch { /* */ } };
  if (!versaoId) throw new Error('Versão em falta.');

  passo('A ler a versão e o documento…');
  const { data: versao, error: eV } = await supabase.from('documento_versao')
    .select('id,documento_id,versao,rotulo,estado,arquivo_uri,arquivo_nome,sha256,aprovado_em,aprovado_por')
    .eq('id', versaoId).maybeSingle();
  if (eV) throw new Error(`Não foi possível ler a versão: ${eV.message || eV}.`);
  if (!versao) throw new Error('A versão não existe ou não tem permissão para a ver.');
  const { data: documento, error: eD } = await supabase.from('documento')
    .select('id,numero,titulo,arquivo_nome,arquivo_privado_uri,aeroporto_id,versao_atual')
    .eq('id', versao.documento_id).maybeSingle();
  if (eD || !documento) throw new Error('Não foi possível ler o documento desta versão.');

  passo('A ler as assinaturas…');
  const todas = await lerAssinaturas({ documentoId: documento.id });
  const linhas = linhasDaVersao(todas, versaoId);
  if (!linhas.some(l => l.acto === 'aprovacao')) {
    throw new Error('Esta versão ainda não foi aprovada no fluxo: não há cópia assinada a gerar.');
  }

  const { data: rubData, error: eR } = await supabase.rpc('doc_rubricas_da_versao', { p_versao: versaoId });
  if (eR) throw erro186(eR, 'ler as rubricas dos signatários');
  const rubricas = rubricasPorEmail(rubData);

  passo('A obter o PDF original assinado…');
  const ficheiros = await lerFicheiros({ versaoId });
  const original = pdfOriginalDaVersao(ficheiros, linhas);
  if (!original?.sha256) throw new Error('Não foi encontrado o PDF original assinado desta versão.');
  const shaOriginal = String(original.sha256).toLowerCase();

  const [geradores, logo, rascunho] = await Promise.all([
    import('./edicao/copiaAssinada.js'),
    carregarLogoSga(),
    lerRascunhoDaVersao(versaoId, documento.id),
  ]);
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const escolha = escolherModoCopia({ rascunho, versaoId, versaoSha: versao.sha256, shaOriginal });

  let blob;
  if (escolha.modo === 'estruturado') {
    passo('A gerar a cópia a partir do conteúdo do editor…');
    blob = await geradores.gerarCopiaEstruturada({ conteudo: escolha.conteudo, linhasAssinatura: linhas, rubricas, origem, shaOriginal, logo });
  } else {
    const pdfOriginal = await obterPdfOriginal(original, shaOriginal);
    passo('A acrescentar as assinaturas ao PDF…');
    blob = await geradores.gerarCopiaDeFicheiro({
      pdfOriginal, documento, versao, linhasAssinatura: linhas, rubricas, origem, shaOriginal, logo,
      // documentos longos (o MOA tem ~156 páginas) levam dezenas de segundos: mostra-se a página em curso
      onProgresso: (feitas, total) => { if (total) passo(`A acrescentar as assinaturas ao PDF… página ${feitas} de ${total}`); },
    });
  }
  if (!blob || typeof blob.size !== 'number' || !blob.size) throw new Error('O gerador não devolveu o PDF da cópia.');

  passo('A calcular a impressão digital…');
  const sha256 = await impressaoDigital(blob);
  if (!sha256 || sha256.length !== 64) throw new Error('Não foi possível calcular a impressão digital da cópia.');

  passo('A enviar a cópia assinada…');
  const nome = nomeCopiaAssinada(documento, versao);
  const caminho = caminhoCopiaAssinada({ documentoId: documento.id, nome });
  const file = typeof File !== 'undefined' ? new File([blob], caminho.split('/').pop(), { type: 'application/pdf' }) : blob;
  const envio = await supabase.storage.from(BUCKET).upload(caminho, file, { contentType: 'application/pdf', upsert: false });
  if (envio.error) throw new Error(`Não foi possível enviar a cópia para o armazenamento: ${envio.error.message || 'falha no envio'}.`);

  passo('A registar a cópia…');
  const { data: id, error: eReg } = await supabase.rpc('doc_copia_assinada_registar', {
    p_versao: versaoId, p_caminho: envio.data?.path || caminho, p_sha256: sha256, p_tamanho: blob.size,
    p_nome: nome, p_origem_sha256: shaOriginal,
  });
  if (eReg) throw erro186(eReg, 'registar a cópia assinada');

  const codigo = typeof geradores.codigoVerificacao === 'function' ? geradores.codigoVerificacao(shaOriginal) : codigoDeSha(shaOriginal);
  if (actor) {
    try { await auditarDocs(actor, { acao: 'documento_copia_assinada', id: documento.id, detalhes: `Cópia assinada gerada (versão ${versao.versao}, ${escolha.modo})` }); } catch { /* */ }
  }
  return { id: umaLinha(id)?.id || id, caminho, sha256, nome, codigo, modo: escolha.modo };
}

/**
 * Em segundo plano, com avisos: usado no fim da aprovação. Nunca atira — a aprovação já está feita; se a cópia
 * falhar, só se avisa (pode gerar-se depois na página do documento).
 */
export function gerarCopiaEmSegundoPlano(versaoId, { actor = null, onFeito } = {}) {
  if (!versaoId) return;
  const aviso = toast({ title: 'A preparar a cópia assinada…', description: 'Pode continuar a trabalhar.', duration: 120000 });
  gerarERegistarCopiaAssinada(versaoId, { actor })
    .then((r) => {
      aviso.update({ id: aviso.id, title: 'Cópia assinada pronta', description: r?.codigo ? `Código de verificação ${r.codigo}.` : 'Já está na página do documento.', variant: 'default' });
      setTimeout(() => aviso.dismiss(), 6000);
      try { onFeito?.(r); } catch { /* */ }
    })
    .catch((e) => {
      aviso.update({
        id: aviso.id,
        title: 'A aprovação ficou registada, mas a cópia assinada não foi gerada',
        description: `${e?.message || 'Erro desconhecido.'} Pode gerá-la mais tarde na página do documento.`,
        variant: 'destructive',
      });
      setTimeout(() => aviso.dismiss(), 15000);
    });
}
