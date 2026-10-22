import { describe, it, expect } from 'vitest';
import { normalizarNiveisTitulos, numerarTitulos, normalizarTitulosDocumento } from '../comum';

const h = (level, t) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: t }] });
const p = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });

describe('títulos sem saltos de nível', () => {
  it('H4 logo a seguir ao título da secção passa a H2', () => {
    const r = normalizarNiveisTitulos({ type: 'doc', content: [h(4, 'a'), p('x')] });
    expect(r.content[0].attrs.level).toBe(2);
  });
  it('H2 → H4 passa a H2 → H3; uma sequência correcta fica igual', () => {
    const r = normalizarNiveisTitulos({ type: 'doc', content: [h(2, 'a'), h(4, 'b'), h(3, 'c'), h(4, 'd')] });
    expect(r.content.map(n => n.attrs.level)).toEqual([2, 3, 3, 4]);
  });
  it('a numeração nunca tem zeros', () => {
    const doc = normalizarTitulosDocumento({ seccoes: [{ titulo: 'S1', conteudo: { type: 'doc', content: [h(2, 'a')] } }, { titulo: 'S2', conteudo: { type: 'doc', content: [h(4, 'x'), h(4, 'y')] } }] });
    const { titulos } = numerarTitulos(doc);
    const nums = doc.seccoes[1].conteudo.content.map(n => titulos.get(n));
    expect(nums).toEqual(['2.1', '2.1.1']);
    expect(nums.join(' ')).not.toMatch(/\.0/);
  });
  it('não altera o original', () => {
    const orig = { type: 'doc', content: [h(4, 'a')] };
    normalizarNiveisTitulos(orig);
    expect(orig.content[0].attrs.level).toBe(4);
  });
});
