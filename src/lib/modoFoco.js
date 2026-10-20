// Modo foco da Universidade Corporativa: durante uma aula ou avaliação escondem-se o menu lateral e o
// cabeçalho da aplicação (Layout lê `useModoFoco`; CSS em index.css esconde `.foco-ocultar` quando
// o wrapper tem data-foco="1"). Preferência do utilizador guardada em localStorage.
import { useSyncExternalStore } from 'react';

const CHAVE = 'formacao:modo-foco';
let activo = false;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(fn => { try { fn(); } catch { /* */ } });

export function setModoFoco(v) { const n = !!v; if (n === activo) return; activo = n; avisar(); }
export function getModoFoco() { return activo; }
export function preferenciaModoFoco() { try { const v = localStorage.getItem(CHAVE); return v == null ? true : v === '1'; } catch { return true; } }
export function guardarPreferenciaModoFoco(v) { try { localStorage.setItem(CHAVE, v ? '1' : '0'); } catch { /* */ } }
export function useModoFoco() {
  return useSyncExternalStore((fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); }, () => activo, () => false);
}
