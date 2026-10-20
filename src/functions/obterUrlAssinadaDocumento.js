import { supabase, URL_BASE } from '@/lib/supabaseClient';

// Endereço temporário (5 min) para ver ou descarregar o ficheiro de um documento guardado em storage privado.
//
// Porque não usamos `supabase.storage.createSignedUrl`: o nosso servidor devolve o caminho JÁ COMPLETO
// («/storage/v1/object/sign/…»), enquanto a biblioteca espera um caminho relativo à raiz do storage e volta a
// juntar-lhe o prefixo. O resultado era «/storage/v1/storage/v1/object/sign/…», que não casa com nenhuma rota do
// nginx e cai na página da aplicação — a pré-visualização mostrava o ecrã de entrada do DIROPS dentro do visualizador.
// Aqui pedimos o endereço directamente e aceitamos as duas formas de resposta.
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const VALIDADE_S = 300;

export function enderecoAssinado(caminho, base = URL_BASE) {
  const c = String(caminho || '');
  if (!c) return '';
  if (/^https?:\/\//i.test(c)) return c;                                  // já é absoluto
  if (c.startsWith('/storage/')) return base + c;                         // caminho completo (o que o nosso servidor devolve)
  return base + '/storage/v1' + (c.startsWith('/') ? c : '/' + c);        // caminho relativo à raiz do storage
}

export async function obterUrlAssinadaDocumento({ documento_id, validade_s = VALIDADE_S }) {
  const { data: documento, error } = await supabase
    .from('documento')
    .select('id,arquivo_privado_uri,arquivo_url,usar_storage_privado')
    .eq('id', documento_id)
    .single();

  if (error || !documento) throw new Error('Documento não encontrado');

  const chave = String(documento.arquivo_privado_uri || '').replace(/^\//, '');
  if (!chave) {
    if (documento.arquivo_url) return { success: true, url: documento.arquivo_url, public: true };
    throw new Error('Este documento não tem ficheiro associado');
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
    const corpo = await r.text().catch(() => '');
    throw new Error(r.status === 403 || r.status === 401
      ? 'Não tem permissão para abrir este ficheiro.'
      : `Não foi possível preparar o ficheiro (${r.status}). ${corpo.slice(0, 120)}`);
  }
  const j = await r.json().catch(() => ({}));
  const url = enderecoAssinado(j.signedURL || j.signedUrl || j.url);
  if (!url) throw new Error('O servidor não devolveu o endereço do ficheiro.');
  return { success: true, url, expires_in: validade_s };
}
