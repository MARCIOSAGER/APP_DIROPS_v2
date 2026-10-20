// Imagens do portal: redimensionamento no navegador antes do carregamento (evita ficheiros de vários MB no cabeçalho)
// e imagens padrão quando não há nenhuma configurada.
import { uploadFicheiro } from '@/components/formacao/gestao/ImagemUpload';

export const IMAGENS_PADRAO = {
  inicio: { url: '/imagens-portal/hero-soyo.jpg', urlPequena: '/imagens-portal/hero-soyo-960.jpg', credito: 'Aeroporto do Soyo · Foto: SGA' },
  entrada: { url: '/imagens-portal/entrada-kalandula.jpg', credito: 'Quedas de Kalandula, Malanje' },
  // Cabeçalho do Portal de Documentos (GED) — usa as mesmas colunas imagem_inicio_* (documentos_config, migr 176).
  // Wikimedia Commons, «Lubango Airport.jpg», Marcos Lana, CC BY-SA 2.0 (o crédito tem de ficar visível).
  ged: { url: '/imagens-portal/ged-lubango.jpg', urlPequena: '/imagens-portal/ged-lubango-960.jpg', credito: 'Aeroporto da Mukanka, Lubango · Foto: Marcos Lana (CC BY-SA 2.0)' },
};

// Devolve { url, urlPequena, credito, personalizada } para o cabeçalho ('inicio' / 'ged') ou a entrada ('entrada').
export function imagemPortal(cfg, qual) {
  const padrao = IMAGENS_PADRAO[qual];
  const url = qual === 'entrada' ? cfg?.imagem_entrada_url : cfg?.imagem_inicio_url;
  const credito = qual === 'entrada' ? cfg?.imagem_entrada_credito : cfg?.imagem_inicio_credito;
  if (url) return { url, urlPequena: null, credito: (credito || '').trim(), personalizada: true };
  return { url: padrao.url, urlPequena: padrao.urlPequena || null, credito: (credito ?? padrao.credito) || '', personalizada: false };
}

// Reduz a imagem (largura máxima, JPEG) no navegador. Ficheiros já pequenos passam sem alteração.
export async function redimensionarImagem(file, { maxLargura = 1920, qualidade = 0.86 } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  const bitmap = await createImageBitmap(file);
  try {
    const escala = Math.min(1, maxLargura / bitmap.width);
    if (escala === 1 && file.size <= 600 * 1024 && file.type === 'image/jpeg') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala); canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', qualidade));
    const nome = String(file.name || 'imagem').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } finally { try { bitmap.close?.(); } catch { /* */ } }
}

// Redimensiona e envia para o storage público; devolve a URL relativa.
export async function carregarImagemPortal(file, opts) {
  const pronto = await redimensionarImagem(file, opts);
  return uploadFicheiro(pronto);
}
