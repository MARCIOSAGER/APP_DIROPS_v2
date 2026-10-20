// Cópias offline dos documentos do Portal de Documentos.
//
// Porque existe: num aeroporto a rede cai, e o manual que diz o que fazer quando a rede cai está... na rede.
// Quem marca um documento fica com o ficheiro guardado NESTE navegador, e o leitor abre-o sem pedir nada ao
// servidor.
//
// DECISÃO DELIBERADA: isto é IndexedDB puro, SEM Service Worker. A aplicação remove activamente qualquer Service
// Worker em cada arranque (src/main.jsx) e o public/sw.js é um kill-switch que se desregista e limpa todos os
// caches — foi posto lá porque um SW antigo servia JavaScript velho e obrigava a Ctrl+Shift+R depois de cada
// publicação. O aviso de versão nova (AppUpdateBanner) assenta nessa mesma premissa: compara o index.html da rede
// com o que a aba carregou. Um SW a servir o index.html em cache desarmava esse aviso em silêncio — exactamente o
// problema que já custou dias a este projecto. Por isso: os BYTES do documento ficam offline, o código da
// aplicação não. Consequência honesta, dita também na interface: a cópia serve a aba que já está aberta quando a
// rede cai, e volta a servir enquanto o navegador ainda tem a aplicação em cache; abrir o portal de zero sem rede
// nenhuma continua a não funcionar.
//
// Uma cópia offline que envelhece em silêncio é PIOR do que não haver cópia: quem opera acredita nela. Daí
// `estadoCopia()`, que devolve sempre um veredicto — e, quando não há rede para confirmar, diz que não confirmou.

const BD = 'dirops-documentos-offline';
const VERSAO_BD = 1;
const FICHEIROS = 'ficheiros';
const PAGINAS = 'paginas';

// Passados estes dias sem reconfirmar contra o servidor, a cópia deixa de ser tratada como boa só porque existe.
export const DIAS_ATE_DUVIDA = 30;

export const offlineDisponivel = () => typeof indexedDB !== 'undefined';

let promessaBD = null;
function abrir() {
  if (!offlineDisponivel()) return Promise.reject(new Error('Este navegador não guarda documentos para ler sem rede.'));
  if (promessaBD) return promessaBD;
  promessaBD = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BD, VERSAO_BD);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(FICHEIROS)) bd.createObjectStore(FICHEIROS, { keyPath: 'documento_id' });
      if (!bd.objectStoreNames.contains(PAGINAS)) bd.createObjectStore(PAGINAS, { keyPath: 'documento_id' });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error || new Error('Não foi possível abrir o armazenamento local.'));
    pedido.onblocked = () => reject(new Error('Outra aba está a actualizar o armazenamento local. Feche-a e tente de novo.'));
  }).catch((e) => { promessaBD = null; throw e; });
  return promessaBD;
}

function transaccao(loja, modo, trabalho) {
  return abrir().then(bd => new Promise((resolve, reject) => {
    let resultado;
    const tx = bd.transaction(loja, modo);
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error || new Error('O armazenamento local recusou a operação.'));
    tx.onabort = () => reject(tx.error || new Error('O armazenamento local cancelou a operação.'));
    const pedido = trabalho(tx.objectStore(loja));
    if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };
  }));
}

// Os bytes nunca viajam no meta: ler a lista de cópias não deve trazer dezenas de MB de PDF para a memória.
const semBlob = (r) => {
  if (!r) return null;
  const { blob, ...resto } = r;
  return { ...resto, tem_ficheiro: !!blob };
};

// ── gravar ─────────────────────────────────────────────────────────────────
// `paginas` é o índice de texto por página (migração 151) guardado ao lado do ficheiro, para a pesquisa dentro do
// documento também funcionar sem rede. Se não vier, grava-se o ficheiro de qualquer maneira: ler é o essencial.
export async function guardarCopia({ documento_id, blob, meta, paginas }) {
  if (!documento_id) throw new Error('Falta o documento.');
  if (!blob) throw new Error('Não há ficheiro para guardar.');
  // Pedir persistência evita que o navegador despeje a cópia quando o disco aperta — que é precisamente quando
  // ela faz falta. Falhar aqui não impede nada: guarda-se em armazenamento normal.
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* opcional */ }
  const registo = {
    documento_id,
    blob,
    bytes: blob.size || 0,
    tipo: blob.type || 'application/pdf',
    guardado_em: new Date().toISOString(),
    ...meta,
  };
  await transaccao(FICHEIROS, 'readwrite', loja => loja.put(registo));
  if (Array.isArray(paginas) && paginas.length) {
    await transaccao(PAGINAS, 'readwrite', loja => loja.put({
      documento_id,
      guardado_em: registo.guardado_em,
      linhas: paginas.map(p => ({ pagina: p.pagina, pagina_fonte: p.pagina_fonte, rotulo: p.rotulo, texto: p.texto })),
    })).catch(() => { /* o índice é um extra; o ficheiro já está guardado */ });
  }
  return semBlob(registo);
}

// ── ler ────────────────────────────────────────────────────────────────────
export function obterCopia(documento_id) {
  if (!documento_id) return Promise.resolve(null);
  return transaccao(FICHEIROS, 'readonly', loja => loja.get(documento_id)).catch(() => null);
}
export function obterMeta(documento_id) {
  return obterCopia(documento_id).then(semBlob);
}
export function obterPaginasOffline(documento_id) {
  if (!documento_id) return Promise.resolve([]);
  return transaccao(PAGINAS, 'readonly', loja => loja.get(documento_id))
    .then(r => (Array.isArray(r?.linhas) ? r.linhas : []))
    .catch(() => []);
}
export function listarCopias() {
  return transaccao(FICHEIROS, 'readonly', loja => loja.getAll())
    .then(rs => (Array.isArray(rs) ? rs.map(semBlob).sort((a, b) => String(b.guardado_em).localeCompare(String(a.guardado_em))) : []))
    .catch(() => []);
}
export async function apagarCopia(documento_id) {
  if (!documento_id) return;
  await transaccao(FICHEIROS, 'readwrite', loja => loja.delete(documento_id));
  await transaccao(PAGINAS, 'readwrite', loja => loja.delete(documento_id)).catch(() => { /* idem */ });
}
export async function espacoOffline() {
  try {
    const e = await navigator.storage?.estimate?.();
    return { usado: e?.usage || 0, quota: e?.quota || 0 };
  } catch { return { usado: 0, quota: 0 }; }
}

// ── a assinatura da versão ─────────────────────────────────────────────────
// O que distingue uma revisão de outra, do lado do cliente: a versão em uso, a última alteração do registo e o
// caminho do ficheiro. A migração 151 invalida o índice de conteúdo quando mudam estas mesmas colunas — a
// definição de «mudou» é a mesma dos dois lados, de propósito.
export const assinaturaDocumento = (doc) => [
  doc?.versao_atual || doc?.versao || '1',
  doc?.updated_date || '',
  doc?.arquivo_privado_uri || doc?.arquivo_url || '',
].join('|');

export function metaDeDocumento(doc, extra = {}) {
  return {
    assinatura: assinaturaDocumento(doc),
    versao: String(doc?.versao_atual || doc?.versao || '1'),
    updated_date: doc?.updated_date || null,
    titulo: doc?.titulo || '',
    numero: doc?.numero || '',
    estado: doc?.estado || '',
    expira_em: doc?.expira_em || doc?.data_expiracao || null,
    em_vigor_desde: doc?.em_vigor_desde || doc?.publicacao_em || doc?.data_publicacao || null,
    ...extra,
  };
}

const diasDesde = (desde) => {
  const t = Date.parse(desde || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const idadeEmPalavras = (d) => (d === 0 ? 'hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`);

// Veredicto sobre uma cópia guardada. Devolve sempre um `nivel`:
//   'confirmada' — foi comparada com o servidor agora e é a versão em uso;
//   'velha'      — o servidor tem revisão mais recente (ou o documento foi retirado): NÃO usar para operar;
//   'expirada'   — a validade do documento já passou (dá-se por isso mesmo sem rede, pelo relógio do dispositivo);
//   'duvida'     — não houve comparação (sem rede): pode já não ser a que manda.
// Nunca devolve «está boa» por omissão: sem confirmação, a resposta é dúvida.
export function estadoCopia(meta, docAoVivo) {
  if (!meta) return null;
  const idade = diasDesde(meta.guardado_em);
  const base = { guardado_em: meta.guardado_em, idade, versao: meta.versao };
  const venceu = !!meta.expira_em && Date.parse(meta.expira_em) < Date.now();

  if (docAoVivo) {
    if (docAoVivo.estado === 'obsoleto') {
      return {
        ...base,
        nivel: 'velha',
        titulo: 'Esta cópia é de um documento que foi retirado',
        texto: 'O documento está marcado como obsoleto no servidor. Não o use para operar nem o distribua: apague a cópia e procure na Biblioteca o que está em vigor.',
      };
    }
    if (assinaturaDocumento(docAoVivo) !== meta.assinatura) {
      const vNova = String(docAoVivo.versao_atual || docAoVivo.versao || '');
      return {
        ...base,
        nivel: 'velha',
        versaoNova: vNova,
        titulo: 'A cópia guardada já não é a versão em vigor',
        texto: `Guardou a versão ${meta.versao} ${idadeEmPalavras(idade)}${vNova && vNova !== meta.versao ? ` e o servidor tem a versão ${vNova}` : ', e o documento mudou no servidor desde então'}. Actualize a cópia antes de voltar a confiar nela.`,
      };
    }
    if (venceu) {
      return {
        ...base,
        nivel: 'expirada',
        titulo: 'A validade deste documento já passou',
        texto: 'A cópia corresponde à versão em uso, mas o próprio documento expirou. Confirme com a gestão documental antes de o usar para operar.',
      };
    }
    return {
      ...base,
      nivel: 'confirmada',
      titulo: 'Cópia confirmada com o servidor',
      texto: `O ficheiro guardado neste navegador é o da versão ${meta.versao}, que é a que está em vigor.`,
    };
  }

  if (venceu) {
    return {
      ...base,
      nivel: 'expirada',
      titulo: 'A validade deste documento já passou',
      texto: 'Está a ler sem ligação ao servidor e a validade registada na cópia já terminou. Não a use para operar sem confirmar.',
    };
  }
  return {
    ...base,
    nivel: 'duvida',
    titulo: idade === null ? 'Não foi possível confirmar esta cópia' : `Cópia guardada ${idadeEmPalavras(idade)}, não confirmada`,
    texto: idade !== null && idade >= DIAS_ATE_DUVIDA
      ? 'Não há ligação ao servidor para confirmar se continua a ser a versão em vigor, e já passou bastante tempo desde que a guardou. Trate-a como suspeita até confirmar.'
      : 'Não há ligação ao servidor para confirmar se continua a ser a versão em vigor. Pode ter saído uma revisão entretanto.',
  };
}
