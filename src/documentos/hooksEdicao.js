// Edição de documentos — Fase F0: reserva para edição (check-out) e revisões novas em RASCUNHO.
//
// Regra sagrada: nunca se mexe num documento aprovado/em vigor. Tudo o que é novo entra como revisão em rascunho
// (documento_versao com estado «rascunho») e segue depois o fluxo de aprovação (IniciarFluxo). O documento em si
// (tabela documento: versao_atual, arquivo_privado_uri, estado) NÃO é tocado aqui.
//
// A reserva vive em documento_reserva (migração tools/ged-edicao/181_documento_reserva.sql) e só se escreve pelas
// funções doc_reservar / doc_libertar; a base recusa (trigger) uma revisão nova de quem não tem a reserva.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { sanitizeFilename, validateFileType } from '@/lib/sanitize';
import { impressaoDigital } from './hooks';
import { planoVersoesRascunho, proximaVersao, bloqueioCarregamento, DIAS_RESERVA } from './edicaoLogica';

export * from './edicaoLogica';

const BUCKET = 'private-uploads';
export const LIMITE_MB_RASCUNHO = 50;               // `client_max_body_size` da rota /storage no nginx
const LIMITE_BYTES = LIMITE_MB_RASCUNHO * 1024 * 1024;

const SEM_MIGRACAO = 'A reserva para edição ainda não está instalada no servidor (migração 181). Avise a gestão do portal.';

// Erros da base em português; as funções da 181 já falam português (sem acentos, por serem ASCII) — passam tal e qual.
export function erroEdicao(error, acao = 'concluir a operação') {
  if (!error) return new Error(`Não foi possível ${acao}.`);
  const msg = String(error.message || error.error || error || '');
  const cod = String(error.code || '');
  if (/documento_reserva|doc_reservar|doc_libertar/i.test(msg) && /does not exist|could not find|schema cache/i.test(msg)) return new Error(SEM_MIGRACAO);
  if (/42P01|42883|PGRST202|PGRST205/.test(cod)) return new Error(SEM_MIGRACAO);
  if (cod === '42501' || /row-level security|permission denied/i.test(msg)) {
    return new Error(/row-level security|permission denied for/i.test(msg)
      ? `Não foi possível ${acao}: não tem permissão para editar este documento.`
      : msg);
  }
  return new Error(msg || `Não foi possível ${acao}.`);
}

// ── reserva ────────────────────────────────────────────────────────────────
// Devolve a linha da reserva (activa OU expirada — o ecrã distingue com estadoReserva) ou null. Se a migração
// ainda não correu, devolve null sem rebentar a ficha.
export function useReservaDocumento(documentoId) {
  return useQuery({
    queryKey: ['gd', 'reserva', documentoId],
    enabled: !!documentoId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_reserva')
        .select('documento_id,reservado_por,reservado_nome,reservado_em,expira_em,nota')
        .eq('documento_id', documentoId).maybeSingle();
      if (error) return null;
      return data || null;
    },
  });
}

export function useRecarregarReserva() {
  const qc = useQueryClient();
  return (documentoId) => {
    qc.invalidateQueries({ queryKey: ['gd', 'reserva', documentoId] });
    qc.invalidateQueries({ queryKey: ['gd', 'versoes', documentoId] });
  };
}

export async function reservarDocumento(documentoId, { nota = null, dias = DIAS_RESERVA } = {}) {
  const { data, error } = await supabase.rpc('doc_reservar', { p_doc: documentoId, p_nota: nota || null, p_dias: dias });
  if (error) throw erroEdicao(error, 'reservar o documento');
  return Array.isArray(data) ? data[0] : data;
}

export async function libertarDocumento(documentoId, { forcar = false, motivo = null } = {}) {
  const { data, error } = await supabase.rpc('doc_libertar', { p_doc: documentoId, p_forcar: !!forcar, p_motivo: motivo || null });
  if (error) throw erroEdicao(error, forcar ? 'forçar a libertação' : 'libertar o documento');
  return data === true;
}

// Lê a reserva no momento (para validar antes de enviar ficheiros grandes).
async function lerReserva(documentoId) {
  const { data, error } = await supabase.from('documento_reserva')
    .select('documento_id,reservado_por,reservado_nome,reservado_em,expira_em')
    .eq('documento_id', documentoId).maybeSingle();
  if (error) return null;
  return data || null;
}

async function emailActual() {
  try {
    const { data } = await supabase.auth.getSession();
    return String(data?.session?.user?.email || '').toLowerCase() || null;
  } catch { return null; }
}

const fmtCurta = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-PT');
};

// ── criarVersaoRascunho ────────────────────────────────────────────────────
// Grava uma revisão NOVA em rascunho de um documento existente. Reutilizada pelo editor estruturado e pela
// integração ONLYOFFICE.
//
//   criarVersaoRascunho({ documentoId, ficheiros, rotulo, nota, onProgresso }) → Promise<Array<documento_versao>>
//
//   documentoId  uuid do documento (obrigatório).
//   ficheiros    [{ blob: Blob|File, nome: string, mime?: string, papel: 'pdf'|'fonte' }] — no máximo um de cada.
//                  · 'pdf'   → a revisão (documento_versao N, estado 'rascunho'); tem de ser .pdf;
//                  · 'fonte' → o original editável (.docx…). Com PDF: linha N+1 com estado 'fonte' e rótulo
//                              «Fonte editável (.docx) — <rótulo>» (o modelo já usado, ex. MOA FNLU v8/v9).
//                              Sem PDF: o próprio fonte é a revisão N em 'rascunho'.
//   rotulo       texto curto da revisão (vazio = o número). nota = «o que mudou» (vai para o histórico).
//   onProgresso  opcional, (fase: string) => void — 'verificar' | 'enviar:<nome>' | 'registar'.
//
// Devolve as linhas inseridas (a primeira é sempre a revisão). Atira Error com mensagem em português se o
// documento estiver reservado por outra pessoa, se faltar permissão ou se um ficheiro for inválido.
// O que faz: valida, calcula a impressão digital (sha256, JS puro se não houver crypto.subtle), envia cada
// ficheiro para o armazenamento PRIVADO (bucket private-uploads, raiz — nunca sob 'editaveis/', que a base recusa
// em documento_versao) e só depois insere as linhas. NÃO altera a tabela documento nem nenhuma revisão existente.
export async function criarVersaoRascunho({ documentoId, ficheiros, rotulo = '', nota = '', onProgresso } = {}) {
  if (!documentoId) throw new Error('Falta o documento.');
  const passo = (f) => { try { onProgresso?.(f); } catch { /* o progresso nunca trava */ } };
  passo('verificar');

  const email = await emailActual();
  const bloqueio = bloqueioCarregamento(await lerReserva(documentoId), email, { fmt: fmtCurta });
  if (bloqueio) throw new Error(bloqueio);

  // validação dos ficheiros antes de enviar seja o que for
  const normalizados = (Array.isArray(ficheiros) ? ficheiros : []).filter(Boolean).map((f) => {
    const nome = sanitizeFilename(f.nome || f.blob?.name || (f.papel === 'pdf' ? 'revisao.pdf' : 'fonte.docx'));
    const mime = f.mime || f.blob?.type || null;
    const blob = f.blob;
    if (!blob || typeof blob.slice !== 'function') throw new Error(`O ficheiro «${nome}» está vazio ou não chegou.`);
    const file = (typeof File !== 'undefined' && blob instanceof File && blob.name === nome)
      ? blob
      : new File([blob], nome, { type: mime || '' });
    return { ...f, nome, mime, file };
  });
  const plano0 = planoVersoesRascunho({ ficheiros: normalizados, rotulo, nota, proxima: 1 }); // valida papéis/extensões
  for (const { ficheiro } of plano0) {
    if ((ficheiro.file.size || 0) > LIMITE_BYTES) {
      throw new Error(`«${ficheiro.nome}» tem ${Math.round(ficheiro.file.size / 1048576)} MB e o limite de envio é ${LIMITE_MB_RASCUNHO} MB.`);
    }
    const v = await validateFileType(ficheiro.file);
    if (!v.valid) throw new Error(`${v.reason} («${ficheiro.nome}»). Verifique se o ficheiro não está corrompido.`);
  }

  // envio para o armazenamento privado (o ficheiro órfão é preferível a uma linha a apontar para o vazio)
  const enviados = new Map();
  for (const { ficheiro } of plano0) {
    passo(`enviar:${ficheiro.nome}`);
    const sha256 = await impressaoDigital(ficheiro.file);
    const caminho = `${Date.now()}_${ficheiro.nome}`;
    const { data, error } = await supabase.storage.from(BUCKET).upload(caminho, ficheiro.file, {
      contentType: ficheiro.mime || 'application/octet-stream', upsert: false,
    });
    if (error) throw new Error(`Não foi possível enviar «${ficheiro.nome}» para o armazenamento: ${error.message || 'falha no envio'}.`);
    enviados.set(ficheiro, { caminho: data?.path || caminho, sha256: sha256 && sha256.length === 64 ? sha256 : null });
  }

  // inserir as linhas; o número é único por documento, por isso relê-se e tenta-se de novo se outro passar à frente
  passo('registar');
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const [{ data: versoes, error: eV }, { data: doc }] = await Promise.all([
      supabase.from('documento_versao').select('versao').eq('documento_id', documentoId),
      supabase.from('documento').select('versao_atual').eq('id', documentoId).maybeSingle(),
    ]);
    if (eV) throw erroEdicao(eV, 'ler as revisões do documento');
    const plano = planoVersoesRascunho({ ficheiros: normalizados, rotulo, nota, proxima: proximaVersao(versoes, doc?.versao_atual) });
    const linhas = plano.map(p => {
      const env = enviados.get(p.ficheiro);
      return {
        documento_id: documentoId, versao: p.versao, rotulo: p.rotulo, nota: p.nota, estado: p.estado,
        arquivo_uri: env.caminho, arquivo_nome: p.ficheiro.nome, tamanho: p.ficheiro.file.size || null,
        mime: p.ficheiro.mime || null, sha256: env.sha256, criado_por: email,
      };
    });
    const { data, error } = await supabase.from('documento_versao').insert(linhas).select('*');
    if (!error) return Array.isArray(data) ? data : [];
    const repetido = String(error.code) === '23505' && /documento_id_versao/i.test(String(error.message || ''));
    if (!repetido) throw erroEdicao(error, 'registar a revisão em rascunho');
  }
  throw new Error('Outra pessoa registou uma revisão ao mesmo tempo. Tente de novo.');
}
