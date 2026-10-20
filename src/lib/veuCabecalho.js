// Véu (degradê) por cima da fotografia do cabeçalho do Início — comum ao Portal de Documentos (GED) e à
// Universidade. Cor + intensidade configuráveis em Configurações (colunas hero_cor / hero_intensidade, migr 177).
// hero_cor: qualquer cor hex (#rrggbb). hero_intensidade: uma predefinição (forte|medio|suave|esquerda) ou
// personalizada «custom:<texto%>:<foto%>:<h|v>» — opacidade do lado do texto, do lado da foto e direcção
// (h = da esquerda para a direita; v = de baixo para cima). Sem migração: cabe nas colunas text existentes.

export const CORES_VEU = [
  { valor: '#0b1f3a', nome: 'Azul-marinho' },
  { valor: '#004a99', nome: 'Azul SGA' },
  { valor: '#0f3d3e', nome: 'Verde-petróleo' },
  { valor: '#14532d', nome: 'Verde' },
  { valor: '#1e293b', nome: 'Grafite' },
  { valor: '#4a1d1d', nome: 'Bordô' },
  { valor: '#000000', nome: 'Preto' },
];
export const COR_VEU_PADRAO = '#0b1f3a';

// Opacidades [opacidade, posição%] por predefinição.
export const INTENSIDADES_VEU = [
  { valor: 'forte', nome: 'Forte', paragens: [[1, 0], [0.85, 50], [0.4, 100]] },
  { valor: 'medio', nome: 'Médio', paragens: [[0.95, 0], [0.65, 50], [0.15, 100]] },
  { valor: 'suave', nome: 'Suave', paragens: [[0.9, 0], [0.45, 50], [0, 100]] },
  { valor: 'esquerda', nome: 'Só à esquerda', paragens: [[0.95, 0], [0.75, 40], [0, 70]] },
];
export const INTENSIDADE_VEU_PADRAO = 'forte';
// Mínimo do lado do texto no modo personalizado: abaixo disto, com uma foto clara, o branco deixa de se ler.
export const MIN_LADO_TEXTO = 55;

export const corValida = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '').trim()) ? String(c).trim().toLowerCase() : COR_VEU_PADRAO);
const rgb = (hex) => { const h = corValida(hex).slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
export const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

// «custom:90:20:h» → { texto: 90, foto: 20, dir: 'h' }; null se não for personalizada.
export function lerPersonalizada(v) {
  const m = /^custom:(\d{1,3}):(\d{1,3}):([hv])$/.exec(String(v || ''));
  if (!m) return null;
  const lim = (n, a, b) => Math.min(b, Math.max(a, Number(n)));
  return { texto: lim(m[1], MIN_LADO_TEXTO, 100), foto: lim(m[2], 0, 100), dir: m[3] };
}
export const escreverPersonalizada = ({ texto, foto, dir }) => `custom:${Math.round(texto)}:${Math.round(foto)}:${dir === 'v' ? 'v' : 'h'}`;

// Estilo inline do véu (style={...}).
export function estiloVeu(cor, intensidade) {
  const c = corValida(cor);
  const p = lerPersonalizada(intensidade);
  if (p) {
    const a = p.texto / 100, b = p.foto / 100, meio = (a + b) / 2;
    const direccao = p.dir === 'v' ? 'to top' : 'to right';
    return { backgroundImage: `linear-gradient(${direccao}, ${rgba(c, a)} 0%, ${rgba(c, meio)} 50%, ${rgba(c, b)} 100%)` };
  }
  const i = INTENSIDADES_VEU.find(x => x.valor === intensidade) || INTENSIDADES_VEU[0];
  return { backgroundImage: `linear-gradient(to right, ${i.paragens.map(([o, pos]) => `${rgba(c, o)} ${pos}%`).join(', ')})` };
}

// Opacidade do véu do lado do texto (para o indicador de contraste).
export function opacidadeLadoTexto(intensidade) {
  const p = lerPersonalizada(intensidade);
  if (p) return p.texto / 100;
  return (INTENSIDADES_VEU.find(x => x.valor === intensidade) || INTENSIDADES_VEU[0]).paragens[0][0];
}

// Contraste WCAG do texto branco no pior caso: o véu (cor × opacidade) por cima de uma zona BRANCA da foto.
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export function contrasteTextoBranco(cor, opacidade) {
  const misturada = rgb(cor).map(v => v * opacidade + 255 * (1 - opacidade));
  return (1.05) / (lum(misturada) + 0.05);
}

export const corVeu = (cfg) => corValida(cfg?.hero_cor);
export const intensidadeVeu = (cfg) => cfg?.hero_intensidade || INTENSIDADE_VEU_PADRAO;
