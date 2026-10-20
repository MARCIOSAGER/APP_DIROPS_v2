// Gera ficheiros de amostra (PDF/DOCX) quando AMOSTRAS_DIR está definido; sem ela, não faz nada.
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gerarPdf } from '../gerarPdfEstruturado';
import { exemploPop } from '../exemploPop';
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
  }, 60000);
  it('grava DOCX', async () => {
    const { gerarDocx } = await import('../gerarDocxEstruturado');
    await gravar('POP-exemplo.docx', await gerarDocx(exemploPop, { logo }));
    await gravar('casos-extremos.docx', await gerarDocx(casoExtremo(logo), { logo }));
  }, 60000);
});
