// Submeter em lote (acto «elaboração») e a vista «À espera da minha revisão» — lógica pura, testável.
//
// Cada fluxo continua a ter a SUA assinatura: uma chamada por fluxo à rota /functions/documentos-aprovacao
// (action 'assinar'), em sequência, com a mesma senha escrita uma vez. Se uma falhar, as outras seguem — excepto
// senha errada (401) ou conta travada (429): aí pára-se logo, para não gastar as 5 tentativas que travam a conta.
const minus = (v) => String(v ?? '').trim().toLowerCase();

/** Fluxos que o elaborador `eu` pode submeter: em rascunho, ou devolvidos ao elaborador. */
export function fluxosParaSubmeter(linhas, eu) {
  const e = minus(eu);
  return (Array.isArray(linhas) ? linhas : []).filter(l => minus(l.elaborador_email) === e
    && (l.estado === 'rascunho' || (l.estado === 'devolvido' && l.devolvido_para !== 'revisor')));
}

/** Fluxos à espera da revisão de `eu` (aguarda revisão, ou devolvidos ao revisor). */
export function fluxosParaRever(linhas, eu) {
  const e = minus(eu);
  return (Array.isArray(linhas) ? linhas : []).filter(l => minus(l.revisor_email) === e
    && (l.estado === 'aguarda_revisao' || (l.estado === 'devolvido' && l.devolvido_para === 'revisor')));
}

/** Porque é que um fluxo não pode ir no lote (texto) — ou null se pode. */
export function impedimentoLote(l) {
  if (!l?.tem_pdf) return 'Sem PDF carregado.';
  if (!l?.tem_editavel) return 'Sem ficheiro editável: submeta-o sozinho, para justificar a falta.';
  return null;
}

/**
 * Submete em sequência. `assinar` = a função de apiFluxo (injectada para se poder testar).
 * @returns {Promise<{ ok: Object[], falhas: Object[], naoTentados: Object[], parouPor: string|null }>}
 */
export async function submeterEmLote(fluxos, { senha, nota = null, assinar, onProgresso } = {}) {
  const ok = [];
  const falhas = [];
  const naoTentados = [];
  let parouPor = null;
  const lista = Array.isArray(fluxos) ? fluxos : [];
  if (!String(senha || '')) throw new Error('Escreva a senha da sua conta para assinar.');
  for (let i = 0; i < lista.length; i++) {
    const l = lista[i];
    if (parouPor) { naoTentados.push({ fluxo: l }); continue; }
    try { onProgresso?.({ indice: i, total: lista.length, fluxo: l }); } catch { /* */ }
    const imp = impedimentoLote(l);
    if (imp) { falhas.push({ fluxo: l, erro: imp }); continue; }
    try {
      const r = await assinar({ fluxoId: l.fluxo_id, acto: 'elaboracao', senha, nota });
      ok.push({ fluxo: l, codigo: r?.codigo || null, aviso: r?.aviso || null });
    } catch (e) {
      falhas.push({ fluxo: l, erro: e?.message || String(e), status: e?.status || null });
      if (e?.status === 401 || e?.status === 429) parouPor = e.status === 401 ? 'Senha incorrecta: nada mais foi assinado.' : (e?.message || 'Conta travada temporariamente.');
    }
  }
  return { ok, falhas, naoTentados, parouPor };
}
