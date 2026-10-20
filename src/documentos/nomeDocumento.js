// Nome e título limpos de um documento do GED — fonte única de verdade.
//
// O título de muitos documentos veio do NOME DO FICHEIRO PDF, com a antiga «Ref MOA» e o código colados à
// frente, por exemplo:  "AP.11.001 # PR-FNMO-PFOA-001 Programa de Formação do Operador - PFOA FINAL".
// A Ref MOA (AN.05.001, AP.11.001…) deixou de ser usada — só o Código do Documento (PR-FNMO-PFOA-001) conta.
// Estas funções separam o título real e constroem um nome de ficheiro padronizado para descarga e para os
// links externos. São usadas no frontend (biblioteca, Lista Mestre, descarga) e replicadas no backend
// (server.js) para o Content-Disposition — se mudar a regra aqui, mude lá também.

// Ref MOA à cabeça: AN.05.001 / AP.11.001 / AN.07-014 / AP.01 (nível único) / AP.1 — com # opcional a seguir.
const RE_REF_MOA = /^\s*(?:AN|AP)\s*[.\- ]?\s*\d{1,3}(?:\s*[.\-]\s*\d{1,3})?\s*#?\s*/i;
const RE_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|png|jpe?g)$/i;
// Número de ordem à cabeça, vindo do nome do ficheiro: "001 ACORDO…", "011 01 PROCED…", "3 - Plano…".
// Só 1–3 algarismos (anos de 4 ficam) e só se a seguir vier MAIÚSCULA ("4 de Fevereiro" fica; "9º RAC" também).
const RE_ORDEM = /^\s*(?:\d{1,3}\s*[-–—.)_:]?\s+){1,2}(?=\p{Lu})/u;

const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Título real, sem Ref MOA, sem código, sem extensão, sem lixo à cabeça.
export function tituloLimpoDoc(doc) {
  const original = String(doc?.titulo || '').trim();
  let t = original;
  const cod = String(doc?.numero || '').trim();
  if (cod) t = t.replace(new RegExp(escaparRegex(cod), 'gi'), ' '); // tira o código onde quer que apareça
  t = t.replace(RE_REF_MOA, '');          // Ref MOA à cabeça
  t = t.replace(RE_EXT, '');              // extensão, se ficou colada
  t = t.replace(/^[\s#\-–—:.]+/, '');     // #, -, :, . soltos à cabeça
  t = t.replace(RE_ORDEM, '');            // número de ordem do ficheiro ("001 ACORDO…")
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || original || '(sem título)';
}

// Nome de ficheiro padronizado: "CÓDIGO — Título.ext" (seguro para Windows/HTTP).
export function nomeFicheiroDoc(doc, { comExtensao = true } = {}) {
  const cod = String(doc?.numero || '').trim();
  const titulo = tituloLimpoDoc(doc);
  let base = [cod, titulo].filter(Boolean).join(' — ');
  base = base.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s{2,}/g, ' ').trim() || 'documento';
  if (!comExtensao) return base;
  const fonte = String(doc?.arquivo_nome || doc?.arquivo_uri || doc?.arquivo_url || '');
  const ext = (fonte.match(RE_EXT)?.[1] || 'pdf').toLowerCase();
  return `${base}.${ext}`;
}

// Formato do ficheiro (PDF, DOCX, PNG…) a partir do nome/endereço guardado — para se ver de relance na tabela.
// Devolve a extensão em maiúsculas (JPG normaliza JPEG) ou null se o documento não tem ficheiro.
export function formatoFicheiroDoc(doc) {
  const fonte = String(doc?.arquivo_nome || doc?.arquivo_privado_uri || doc?.arquivo_uri || doc?.arquivo_url || '');
  const ext = fonte.match(RE_EXT)?.[1];
  if (!ext) return null;
  const e = ext.toLowerCase();
  if (e === 'jpeg') return 'JPG';
  if (e === 'doc') return 'DOC';
  return e.toUpperCase();
}

// Diz se o título guardado está «sujo» (tem Ref MOA ou o código lá dentro) — para a limpeza em massa saber o que mexer.
export function tituloEstaSujo(doc) {
  const t = String(doc?.titulo || '');
  const cod = String(doc?.numero || '').trim();
  if (RE_REF_MOA.test(t)) return true;
  if (cod && t.toUpperCase().includes(cod.toUpperCase())) return true;
  if (RE_EXT.test(t.trim())) return true;
  if (RE_ORDEM.test(t)) return true;
  return false;
}
