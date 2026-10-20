// Exportação Excel/PDF das listas da Gestão de Formação (alunos, matriz, ficha, certificados, resultados).
// Excel: uma folha por bloco. PDF: template DIROPS (cabeçalho com logo, tabelas com quebra de página, rodapé).
import { createPdfDoc, addHeader, addFooter, addSectionTitle, addTable, addKeyValuePairs, checkPageBreak, loadImageAsBase64, PDF } from '@/lib/pdfTemplate';
import { diasAte } from '@/lib/formacaoEstado';

const hojeStr = () => new Date().toISOString().slice(0, 10);
export const nomeFicheiro = (base) => `${String(base || 'export').replace(/[^\wÀ-ſ-]+/g, '_')}_${hojeStr()}`;

export function fmtDataCurta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-PT');
}

// Texto para a coluna "Dias" a partir da validade: "23 d", "expirou há 5 d", "" (sem validade).
export function diasTexto(validoAte, hoje = new Date()) {
  const d = diasAte(validoAte, hoje);
  if (d == null) return '';
  if (d < 0) return `expirou há ${Math.abs(d)} d`;
  if (d === 0) return 'expira hoje';
  return `${d} d`;
}

// folhas: [{ nome, cabecalho: string[], linhas: any[][], larguras?: number[] }]
export async function exportarExcel(base, folhas) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const f of folhas) {
    const ws = XLSX.utils.aoa_to_sheet([f.cabecalho, ...f.linhas]);
    ws['!cols'] = (f.larguras || f.cabecalho.map(() => 18)).map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, String(f.nome || 'Folha').slice(0, 31));
  }
  XLSX.writeFile(wb, `${nomeFicheiro(base)}.xlsx`);
}

// Os PDFs da formação levam sempre a marca SGA (pedido do dono 2026-09-29), independentemente do logo da empresa.
async function logoBase64() {
  try { return await loadImageAsBase64('/logo-sga.png'); } catch { /* */ }
  return null; // sem logótipo de recurso: nunca o do DIROPS
}

// seccoes: [{ titulo?, pares?: [{label,value}], colunas?: [{label,width,align}], linhas?: any[][], vazio? }]
// larguras em mm; se a soma exceder a página, addTable reduz proporcionalmente.
export async function exportarPdf({ base, titulo, subtitulo, meta = [], seccoes = [], paisagem = false, empresaId = null, geradoPor = null }) {
  const doc = await createPdfDoc({ orientation: paisagem ? 'landscape' : 'portrait' });
  const logo = await logoBase64(empresaId);
  let y = addHeader(doc, { title: titulo, subtitle: subtitulo, logoBase64: logo, date: new Date().toLocaleDateString('pt-PT'), meta });
  for (const s of seccoes) {
    y = checkPageBreak(doc, y, 24);
    if (s.titulo) y = addSectionTitle(doc, y, s.titulo);
    if (s.pares?.length) y = addKeyValuePairs(doc, y, s.pares, { twoColumns: s.pares.length > 4 }) + 2;
    if (s.colunas) {
      if (!s.linhas?.length) {
        doc.setFontSize(PDF.font.body); doc.setTextColor(...PDF.colors.muted);
        doc.text(s.vazio || 'Sem registos.', PDF.margin.left, y + 4); y += 10;
      } else {
        y = addTable(doc, y, { columns: s.colunas, rows: s.linhas.map(l => l.map(v => (v == null ? '' : String(v)))) }) + 6;
      }
    }
  }
  addFooter(doc, { generatedBy: geradoPor || undefined, systemName: 'Universidade Corporativa — SGA' });
  doc.save(`${nomeFicheiro(base)}.pdf`);
}
