// ============================================================
// Paleta e cores de série PARTILHADAS por todos os relatórios/gráficos.
// FONTE ÚNICA (browser + Node). PADRÃO:
//   • séries CONHECIDAS (componentes de faturação, tipos de voo) -> cor FIXA,
//     estável em qualquer relatório, independente da ordem;
//   • séries DINÂMICAS (companhias, aeroportos) -> cor por POSIÇÃO no gráfico,
//     de uma paleta perceptualmente distinta -> NENHUMA barra repete cor.
// ============================================================

// Paleta distinta, ordenada para máxima separação entre índices consecutivos.
export const PALETTE = [
  [37, 99, 235],   // 1 azul
  [234, 88, 12],   // 2 laranja
  [22, 163, 74],   // 3 verde
  [219, 39, 119],  // 4 rosa/magenta
  [168, 85, 247],  // 5 roxo
  [13, 148, 136],  // 6 teal
  [202, 138, 4],   // 7 dourado
  [220, 38, 38],   // 8 vermelho
  [79, 70, 229],   // 9 índigo
  [132, 204, 22],  // 10 lima
  [8, 145, 178],   // 11 ciano
  [100, 116, 139], // 12 ardósia
];

// Cor FIXA das séries conhecidas (componentes de faturação e tipos de voo).
// Devolve null se a série não for conhecida (aí usa-se cor por posição).
function fixedColor(label) {
  const s = String(label || '').toLowerCase();
  // --- componentes de faturação ---
  if (s.includes('passageiro')) return [37, 99, 235];        // azul
  if (s.includes('permanência') || s.includes('permanencia') || s.includes('estacion')) return [234, 88, 12]; // laranja
  if (s.includes('aterrag') || s.includes('descolag') || s.includes('pouso')) return [22, 163, 74]; // verde
  if (s.includes('carga')) return [13, 148, 136];            // teal
  if (s.includes('serviço') || s.includes('servico')) return [202, 138, 4]; // dourado
  if (s.includes('recurso')) return [79, 70, 229];           // índigo
  if (s.includes('outra')) return [220, 38, 38];             // vermelho
  if (s.includes('imposto')) return [168, 85, 247];          // roxo
  // --- tipos de voo ---
  if (s.includes('regular')) return (s.includes('não') || s.includes('nao')) ? [22, 163, 74] : [37, 99, 235];
  if (s.includes('militar')) return [234, 88, 12];           // laranja
  if (s.includes('técnico') || s.includes('tecnico')) return [168, 85, 247]; // roxo
  if (s.includes('oficial')) return [13, 148, 136];          // teal
  if (s === 'outro' || s === 'outros') return [100, 116, 139]; // ardósia
  return null;
}

// Cor de série. Passa o ÍNDICE da barra no gráfico para as séries dinâmicas
// (companhias/aeroportos) — assim nenhuma cor se repete dentro do mesmo gráfico.
export function serieColor(label, index = 0) {
  const fx = fixedColor(label);
  if (fx) return fx;
  const n = PALETTE.length;
  return PALETTE[((Math.floor(index) % n) + n) % n];
}

// Compat: cor só pelo nome (hash determinístico) — usar serieColor(label, i) quando
// houver índice disponível (evita repetição dentro do gráfico).
export function stableColor(label) {
  const fx = fixedColor(label);
  if (fx) return fx;
  const s = String(label || '');
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Atribuição ao NÍVEL DO GRÁFICO: recebe TODOS os rótulos e devolve uma cor por
// rótulo, garantindo que NENHUMA se repete (até 12 séries). Séries conhecidas ficam
// com a cor canónica; as restantes (e quaisquer colisões) recebem a próxima cor da
// paleta ainda não usada. Preferir isto a serieColor() quando se tem a lista toda.
export function serieColorList(labels) {
  const used = new Set();
  const result = new Array(labels.length).fill(null);
  // 1.ª passagem: cor fixa, mas só a 1.ª ocorrência de cada cor (evita fixas repetidas)
  labels.forEach((l, i) => {
    const fx = fixedColor(l);
    if (fx && !used.has(fx.join(','))) { used.add(fx.join(',')); result[i] = fx; }
  });
  // 2.ª passagem: preencher os restantes com cores da paleta ainda não usadas
  let pi = 0;
  const nextFree = () => {
    for (let k = 0; k < PALETTE.length; k++) {
      const c = PALETTE[(pi + k) % PALETTE.length];
      if (!used.has(c.join(','))) { pi += k + 1; used.add(c.join(',')); return c; }
    }
    return PALETTE[(pi++) % PALETTE.length]; // >12 séries: aí sim pode repetir
  };
  return result.map((c) => c || nextFree());
}
export function serieColorListHex(labels) {
  return serieColorList(labels).map(([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join(''));
}

// Versões hex (#rrggbb) para gráficos HTML/SVG (ex.: dashboard no browser).
export function serieColorHex(label, index = 0) {
  const [r, g, b] = serieColor(label, index);
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export const stableColorHex = (label) => {
  const [r, g, b] = stableColor(label);
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
};
