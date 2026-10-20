// Edição no navegador (ONLYOFFICE Docs) — lógica do cliente, sem React.
//
// O servidor é que decide tudo o que importa (permissão, reserva, versão editável, assinatura do config): ver
// functions/dirops-functions/docs-onlyoffice.js (patch 31). Aqui só se decide se o botão aparece e como se carrega
// o editor. Desligado por omissão: sem `documentos_config.onlyoffice_activo = true` (migração 184) nada aparece.
import { supabase } from '@/lib/supabaseClient';

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ESTADOS_EDITAVEIS = ['fonte', 'rascunho', 'em_vigor'];   // o mesmo critério do servidor
export const TEMPO_LIMITE_API_MS = 15000;

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const ehDocx = (v) => !!v && (String(v.mime || '') === MIME_DOCX || /\.docx$/i.test(String(v.arquivo_nome || v.arquivo_uri || '')));

// A configuração liga a edição? (as colunas só existem depois da migração 184; antes disso `cfg` não as tem)
export function edicaoNavegadorActiva(cfg) {
  return !!cfg && cfg.onlyoffice_activo === true && !!String(cfg.onlyoffice_url || '').trim();
}

// A versão a abrir: a mais recente que seja .docx e esteja em fonte/rascunho/em vigor (nunca uma obsoleta).
export function escolherVersaoFonte(versoes) {
  const lista = (Array.isArray(versoes) ? versoes : [])
    .filter(v => ehDocx(v) && ESTADOS_EDITAVEIS.includes(String(v.estado)) && v.arquivo_uri);
  lista.sort((a, b) => (Number(b.versao) || 0) - (Number(a.versao) || 0));
  return lista[0] || null;
}

// Endereço do api.js. O index.html tem CSP 'self': o script e o iframe do editor só carregam da MESMA origem da
// aplicação. Se o Document Server está atrás do nginx num caminho (/onlyoffice), usa-se esse caminho na origem
// actual — assim funciona quer a pessoa entre por http://srvkms001 quer pelo IP.
export function resolverApiJs(onlyofficeUrl, origemActual) {
  const bruto = String(onlyofficeUrl || '').trim().replace(/\/+$/, '');
  if (!bruto) return null;
  let u; try { u = new URL(bruto); } catch { return null; }
  const caminho = u.pathname.replace(/\/+$/, '');
  const base = caminho && origemActual ? String(origemActual).replace(/\/+$/, '') + caminho : bruto;
  return base + '/web-apps/apps/api/documents/api.js';
}

// Traduz a resposta do servidor numa mensagem para a pessoa.
export function mensagemErroConfig(status, json) {
  const code = json?.code;
  if (code === 'onlyoffice_desligado') return 'A edição no navegador está desligada neste servidor.';
  if (code === 'sem_reserva') return json?.error || 'Reserve o documento antes de o editar.';
  if (status === 404 && !json?.error) return 'O serviço de edição ainda não está ligado no servidor (patch 31 e reinício do dirops-functions-v2).';
  if (status === 503) return json?.error || 'O servidor de edição está indisponível.';
  return json?.error || `Falha ao preparar o editor (${status}).`;
}

// Pede ao servidor o config assinado do editor para uma versão.
export async function pedirConfigEditor(versaoId) {
  let token = ANON;
  try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch { /* sem sessão */ }
  let r;
  try {
    r = await fetch(`${BASE}/functions/v1/documentos-onlyoffice/config?versao=${encodeURIComponent(versaoId)}`, {
      headers: { Authorization: `Bearer ${token}`, apikey: ANON },
    });
  } catch {
    throw new Error('Sem ligação ao servidor. Verifique a rede e tente novamente.');
  }
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) { const e = new Error(mensagemErroConfig(r.status, json)); e.status = r.status; e.code = json?.code; throw e; }
  return json;
}

// Carrega o api.js uma vez por endereço. Rejeita com «indisponível» se falhar ou demorar mais do que o limite.
const _scripts = new Map();
export function carregarApiOnlyOffice(src, tempoLimite = TEMPO_LIMITE_API_MS) {
  if (typeof window !== 'undefined' && window.DocsAPI?.DocEditor) return Promise.resolve(window.DocsAPI);
  if (_scripts.has(src)) return _scripts.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    let feito = false;
    const fim = (erro) => {
      if (feito) return; feito = true; clearTimeout(t);
      if (erro || !window.DocsAPI?.DocEditor) {
        s.remove(); _scripts.delete(src);
        reject(new Error('O servidor de edição está indisponível. Tente mais tarde ou avise a administração.'));
      } else resolve(window.DocsAPI);
    };
    const t = setTimeout(() => fim(true), tempoLimite);
    s.src = src; s.async = true;
    s.onload = () => fim(false);
    s.onerror = () => fim(true);
    document.head.appendChild(s);
  });
  _scripts.set(src, p);
  return p;
}
