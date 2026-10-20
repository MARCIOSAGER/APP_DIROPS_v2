// Monta a lista dos 5 documentos FINAIS do FNLU (DOCs Finalizados) com nomes de destino no storage.
import fs from 'node:fs';
import crypto from 'node:crypto';
const R = 'C:/dirops/APP_DIROPS_v2/docs/00-ANAC-ICVM/01-DOCs Finalizados/01-FNLU';
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 60);
const h = () => crypto.randomBytes(5).toString('hex').slice(0, 9);
const nome = (num, tit, ext) => `${h()}_${num}-${slug(tit)}.${ext}`;
const FNLU = '7b031fd6-0388-5a61-a8d4-5250ff932a3f', PASTA = 'd3171d67-1839-4701-8be0-6f8ce4b6406c';

const finais = [
  { numero: 'MA-FNLU-MOA-001', titulo: 'Manual de Operações do Aeródromo 4 de Fevereiro (Rev.04)', classe: 'MA', processo: 'MOA',
    pdf: `${R}/Editavel/MA-FNLU-MOA-001 Manual de Operação do Aeródromo Rev.04 (corrigido ANAC).pdf`,
    docx: `${R}/Editavel/MA-FNLU-MOA-001 Manual de Operação do Aeródromo Rev.04 (corrigido ANAC).docx`, rotulo: 'Rev.04 (corrigido ANAC)' },
  { numero: 'MA-FNLU-MGSO-001', titulo: 'Manual de Gestão da Segurança Operacional (Revisado II)', classe: 'MA', processo: 'MGSO',
    pdf: `${R}/MGSO Revisado II 13.05.2026.pdf`,
    docx: `${R}/Editavel/MGSO Revisado II 13.05.2026 (formatação corrigida).docx`, rotulo: 'Revisado II 13.05.2026' },
  { numero: 'PL-FNLU-PSCI-001', titulo: 'Plano de Salvamento e Combate a Incêndio (Rev01)', classe: 'PL', processo: 'PSCI',
    pdf: `${R}/AP.04.001 # PL-FNLU-PSCI-001 Plano de Salvamento e Combate a Incendio Rev01 (002).pdf`,
    docx: `${R}/Editavel/AP.04.001 # PL-FNLU-PSCI-001 Plano de Salvamento e Combate a Incendio Rev01 (002).docx`, rotulo: 'Rev01 (final)' },
  { numero: 'PL-FNLU-PEA-001', titulo: 'Plano de Emergência do Aeroporto', classe: 'PL', processo: 'PEA',
    pdf: `${R}/PLANO DE EMERGÊNCIAS DO AEROPORTO.pdf`,
    docx: `${R}/Editavel/PLANO DE EMERGÊNCIAS DO AEROPORTO.docx`, rotulo: 'Final' },
  { numero: 'MQ-FNLU-PEA-002', titulo: 'Mapa de Quadrícula Interno', classe: 'MQ', processo: 'PEA',
    pdf: `${R}/AP.03.003 # MQ-FNLU-PEA-002 Mapa Quadricula Interno.pdf`, docx: null, rotulo: 'Final' },
];

const plano = finais.map(f => {
  if (!fs.existsSync(f.pdf)) throw new Error('PDF não encontrado: ' + f.pdf);
  const sp = nome(f.numero, f.titulo, 'pdf');
  const sf = f.docx && fs.existsSync(f.docx) ? nome(f.numero, f.titulo + '-fonte', 'docx') : null;
  return { icao: 'FNLU', aeroporto_id: FNLU, pasta_id: PASTA, numero: f.numero, classe: f.classe, processo: f.processo,
    titulo: f.titulo, estado: 'em_vigor', rotulo: f.rotulo,
    principal_abs: f.pdf.replace(/\\/g, '/'), formato: 'pdf', mime: 'application/pdf', stored_principal: sp,
    fonte_abs: sf ? f.docx.replace(/\\/g, '/') : null, fonte_formato: sf ? 'docx' : null,
    fonte_mime: sf ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null, stored_fonte: sf };
});
fs.writeFileSync('C:/dirops/APP_DIROPS_v2/tools/ingest-ged/plano-FINAIS-FNLU.json', JSON.stringify(plano, null, 2));
console.log('Finais FNLU: ' + plano.length + ' documentos');
for (const p of plano) console.log('  ' + p.numero + '  ' + p.titulo + (p.stored_fonte ? '  (+docx)' : ''));
