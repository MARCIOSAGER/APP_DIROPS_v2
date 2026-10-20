// Versões de curso: comparação entre um snapshot guardado e o conteúdo actual (módulos + aulas). ESM puro.
const campo = (a, k) => (a?.[k] == null ? '' : String(a[k]));

export function diferencasVersao(snapshot, atual = {}) {
  const sm = Array.isArray(snapshot?.modulos) ? snapshot.modulos : [];
  const sa = Array.isArray(snapshot?.aulas) ? snapshot.aulas : [];
  const am = Array.isArray(atual.modulos) ? atual.modulos : [];
  const aa = Array.isArray(atual.aulas) ? atual.aulas : [];
  const removidas = [], novas = [], alteradas = [];
  const cmp = (tipo, antigos, novosArr, campos) => {
    const mapNovos = new Map(novosArr.map(x => [x.id, x]));
    const mapAntigos = new Map(antigos.map(x => [x.id, x]));
    for (const o of antigos) if (!mapNovos.has(o.id)) removidas.push({ tipo, id: o.id, titulo: o.titulo || '(sem título)' });
    for (const n of novosArr) if (!mapAntigos.has(n.id)) novas.push({ tipo, id: n.id, titulo: n.titulo || '(sem título)' });
    for (const o of antigos) {
      const n = mapNovos.get(o.id); if (!n) continue;
      const mud = campos.filter(k => campo(o, k) !== campo(n, k));
      if (mud.length) alteradas.push({ tipo, id: o.id, titulo: n.titulo || o.titulo || '(sem título)', detalhe: mud.map(k => `${k}: "${campo(o, k).slice(0, 40)}" → "${campo(n, k).slice(0, 40)}"`).join('; ') });
    }
  };
  cmp('modulo', sm, am, ['titulo', 'ordem']);
  cmp('aula', sa, aa, ['titulo', 'tipo', 'duracao_min', 'modulo_id', 'ordem', 'conteudo_url', 'conclusao']);
  return { removidas, novas, alteradas };
}
