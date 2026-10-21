import { describe, it, expect } from 'vitest';
import { generateHTML, generateJSON } from '@tiptap/core';
import { extensoesContrato } from '../extensoes';
import { larguraPedida } from '../comum';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const doc = (attrs) => ({ type: 'doc', content: [{ type: 'image', attrs: { src: PNG, ...attrs } }] });

describe('tamanho da imagem', () => {
  it('a largura em % sai no HTML como estilo e volta igual', () => {
    const html = generateHTML(doc({ width: '50%' }), extensoesContrato());
    expect(html).toMatch(/width:\s*50%/);
    const ida = generateJSON(html, extensoesContrato());
    expect(ida.content[0].attrs.width).toBe('50%');
  });
  it('sem largura = largura total, sem estilo', () => {
    const html = generateHTML(doc({}), extensoesContrato());
    expect(html).not.toMatch(/width/);
  });
  it('os geradores entendem a percentagem', () => {
    expect(larguraPedida({ width: '25%' })).toEqual({ frac: 0.25 });
    expect(larguraPedida({ width: null })).toBeNull();
  });
});
