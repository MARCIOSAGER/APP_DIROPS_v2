// Web Worker da comparação de versões: o diff de dois manuais de 150 páginas é rápido (~0,1–0,5 s) quando são
// parecidos, mas pode levar segundos quando são muito diferentes — fora da thread principal, o ecrã nunca congela.
import { compararDocumentos } from '../../compararVersoes';

self.onmessage = (ev) => {
  const { id, paginasA, paginasB, opcoes } = ev.data || {};
  try {
    const resultado = compararDocumentos(paginasA, paginasB, opcoes);
    self.postMessage({ id, ok: true, resultado });
  } catch (e) {
    self.postMessage({ id, ok: false, erro: e?.message || String(e) });
  }
};
