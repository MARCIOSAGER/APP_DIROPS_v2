// ============================================================
// Formatação de datas SEGURA. O date-fns `format()` LANÇA "Invalid time value"
// quando recebe uma data nula/inválida (ex.: parseISO(null), new Date(null)).
// Como a app tem um ÚNICO ErrorBoundary global, um único registo com data nula
// numa lista `.map` rebenta a página INTEIRA (white-screen "Erro na Aplicação").
// Estes helpers nunca lançam — devolvem um fallback ('—') em vez de crashar.
// ============================================================
import { parseISO, isValid, format } from 'date-fns';
import { pt } from 'date-fns/locale';

// Aceita string ISO ou Date/number. fmtStr = padrão date-fns. Aplica locale pt.
export function fmtData(value, fmtStr = 'dd/MM/yyyy', fallback = '—') {
  try {
    if (value == null || value === '') return fallback;
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isValid(d) ? format(d, fmtStr, { locale: pt }) : fallback;
  } catch {
    return fallback;
  }
}

// Data + hora ("dd/MM/yyyy HH:mm").
export const fmtDataHora = (value, fallback = '—') => fmtData(value, 'dd/MM/yyyy HH:mm', fallback);
