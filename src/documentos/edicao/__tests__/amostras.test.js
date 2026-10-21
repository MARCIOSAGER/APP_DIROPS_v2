// Gera ficheiros de amostra (PDF/DOCX) quando AMOSTRAS_DIR está definido; sem ela, não faz nada.
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gerarPdf } from '../gerarPdfEstruturado';
import { exemploPop } from '../exemploPop';
import { exemploCompleto, IMAGEM_PISTA } from '../exemploCompleto';
import { casoExtremo } from './casos';

const DIR = process.env.AMOSTRAS_DIR;
const logo = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../../../../public/logo-sga.png')).toString('base64')}`;

export const bytesDe = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(Buffer.from(r.result)); r.onerror = rej; r.readAsArrayBuffer(blob); });

async function gravar(nome, blob) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, nome), await bytesDe(blob));
}

describe.skipIf(!DIR)('amostras', () => {
  it('grava PDF', async () => {
    await gravar('POP-exemplo.pdf', await gerarPdf(exemploPop, { logo }));
    await gravar('casos-extremos.pdf', await gerarPdf(casoExtremo(logo), { logo }));
    await gravar('exemplo-completo.pdf', await gerarPdf(exemploCompleto, { logo }));
    // imagem e tabela com legenda empurradas para o fim da página (a legenda tem de ir com elas)
    const enche = (n) => Array.from({ length: n }, (_, k) => ({ type: 'paragraph', content: [{ type: 'text', text: `Linha de enchimento ${k + 1}.` }] }));
    const cel = (t, cab) => ({ type: cab ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
    await gravar('legendas-quebra.pdf', await gerarPdf({ ...exemploCompleto, seccoes: [{ id: 'q', chave: 'q', titulo: 'Legendas junto à quebra de página', obrigatoria: false, conteudo: { type: 'doc', content: [
      ...enche(30), { type: 'image', attrs: { src: IMAGEM_PISTA, width: '80%', legenda: 'Imagem que já não cabe com a legenda' } },
      ...enche(26), { type: 'table', attrs: { legenda: 'Tabela no fim da página' }, content: [{ type: 'tableRow', content: [cel('Coluna A', true), cel('Coluna B', true)] }, { type: 'tableRow', content: [cel('a'), cel('b')] }] },
    ] } }] }, { logo }));
  }, 60000);
  it('grava DOCX', async () => {
    const { gerarDocx } = await import('../gerarDocxEstruturado');
    await gravar('POP-exemplo.docx', await gerarDocx(exemploPop, { logo }));
    await gravar('casos-extremos.docx', await gerarDocx(casoExtremo(logo), { logo }));
    await gravar('exemplo-completo.docx', await gerarDocx(exemploCompleto, { logo }));
  }, 60000);
});
