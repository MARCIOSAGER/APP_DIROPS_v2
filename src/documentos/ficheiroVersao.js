// Endereço temporário do ficheiro de UMA versão concreta de um documento (não só da actual).
//
// O leitor abre o documento com `obterUrlAssinadaDocumento`, que assina `documento.arquivo_privado_uri` — o ficheiro
// da versão em uso. As outras versões guardam o ficheiro em `documento_versao.arquivo_uri`, no mesmo balde privado;
// assina-se essa chave da mesma forma. Do lado do servidor, a chave de uma versão só é assinada depois do patch 30
// (tools/ged-edicao/patch30-versoes-assinadas.mjs): versões em vigor/aprovadas/obsoletas para quem pode ver o
// documento, rascunhos e fontes só para quem o pode editar. Antes disso o servidor responde 404 e dizemo-lo assim.
import { supabase, URL_BASE } from '@/lib/supabaseClient';
import { enderecoAssinado, obterUrlAssinadaDocumento } from '@/functions/obterUrlAssinadaDocumento';

const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const VALIDADE_S = 300;
const limpa = (c) => String(c || '').replace(/^\//, '');

export class FicheiroVersaoIndisponivel extends Error {}

export async function urlDoFicheiroVersao(versao, doc, { validade_s = VALIDADE_S } = {}) {
  if (!versao) throw new Error('Versão em falta.');
  const chave = limpa(versao.arquivo_uri);
  if (!chave) {
    if (versao.arquivo_url) return versao.arquivo_url;
    throw new FicheiroVersaoIndisponivel(`A versão ${versao.versao} não tem ficheiro associado.`);
  }
  if (/^https?:\/\//i.test(chave)) return chave;
  // a versão em uso: o mesmo caminho do leitor (funciona mesmo sem o patch 30)
  if (doc?.id && chave === limpa(doc.arquivo_privado_uri)) {
    const r = await obterUrlAssinadaDocumento({ documento_id: doc.id, validade_s });
    return r.url;
  }
  let token = ANON;
  try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch { /* sem sessão */ }
  const pedido = `${URL_BASE}/storage/v1/object/sign/private-uploads/${chave.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(pedido, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: validade_s }),
  });
  if (!r.ok) {
    if (r.status === 404 || r.status === 403 || r.status === 401) {
      throw new FicheiroVersaoIndisponivel(`O ficheiro da versão ${versao.versao} não está disponível para si `
        + '(os rascunhos e as fontes editáveis só abrem para quem gere o documento).');
    }
    const corpo = await r.text().catch(() => '');
    throw new Error(`Não foi possível preparar o ficheiro da versão ${versao.versao} (${r.status}). ${corpo.slice(0, 120)}`.trim());
  }
  const j = await r.json().catch(() => ({}));
  const url = enderecoAssinado(j.signedURL || j.signedUrl || j.url);
  if (!url) throw new Error('O servidor não devolveu o endereço do ficheiro.');
  return url;
}
