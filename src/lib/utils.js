import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Copia texto para a area de transferencia com fallback para HTTP simples.
// navigator.clipboard so existe em contexto seguro (HTTPS ou localhost); a app
// interna corre em http://10.1.65.45, onde navigator.clipboard e undefined e
// clipboard.writeText rebentava com "Cannot read properties of undefined".
// Fallback: textarea temporario + document.execCommand('copy'). Devolve Promise<boolean>.
export async function copyToClipboard(text) {
  const str = String(text ?? '');
  try {
    if (navigator?.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch { /* cai para o fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, str.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
