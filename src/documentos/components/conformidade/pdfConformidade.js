// Relatório de Conformidade Regulamentar em PDF nativo (jsPDF) — o que se entrega a uma inspecção ou se guarda como
// evidência: a cobertura por diploma e, por diploma, cada requisito com o seu estado e a prova (documento · página).
// Molde: src/documentos/components/avsec/pdfAvsec.js e src/lib/pdfTemplate.js. Paisagem, porque a tabela é larga.
import { createPdfDoc, addHeader, addFooter, addTable, checkPageBreak, PDF } from '@/lib/pdfTemplate';
import { loadImageAsBase64 } from '@/lib/pdfTemplate';
import { nomeFicheiro } from '@/lib/formacaoExport';
import { fmtData } from '@/lib/safeDate';

const hoje = () => fmtData(new Date());
async function logoSga() { try { return await loadImageAsBase64('/logo-sga.png'); } catch { return null; }

}

// estado do requisito -> rótulo legível para o relatório
const ESTADO = {
  coberto: 'Coberto',
  parcial: 'Parcial',
  planeado: 'Planeado (por confirmar)',
  descoberto: 'Descoberto',
  nao_aplicavel: 'Não aplicável',
};
const grauRot = (g) => ({ cumpre: 'cumpre', parcial: 'parcial', planeado: 'sugerido', nao_aplicavel: 'n/a' }[g] || g || '');

// A prova mais forte de um requisito, em texto curto: «MA-FNMO-MOA-001 · pág 134 (cumpre)».
function provaTexto(r) {
  const ps = Array.isArray(r.provas) ? r.provas : [];
  if (!ps.length) return r.estado === 'descoberto' ? '— sem nada a apontar —' : '';
  // a melhor primeiro: cumpre > parcial > planeado
  const ordem = { cumpre: 0, parcial: 1, planeado: 2, nao_aplicavel: 3 };
  const p = [...ps].sort((a, b) => (ordem[a.grau] ?? 9) - (ordem[b.grau] ?? 9))[0];
  const doc = p.documento_numero || 'documento';
  const pag = p.pagina != null ? ` · pág ${p.pagina}` : '';
  const mais = ps.length > 1 ? ` (+${ps.length - 1})` : '';
  return `${doc}${pag} (${grauRot(p.grau)})${mais}`;
}

export async function pdfRelatorioConformidade({ cobertura = [], matriz = [], geradoPor } = {}) {
  const doc = await createPdfDoc({ orientation: 'landscape' });
  const logo = await logoSga();

  const totalReq = matriz.length;
  const porEstado = matriz.reduce((a, r) => { a[r.estado] = (a[r.estado] || 0) + 1; return a; }, {});
  const criticosDescobertos = matriz.filter(r => r.estado === 'descoberto' && r.criticidade === 'alta').length;

  let y = addHeader(doc, {
    title: 'Relatório de Conformidade Regulamentar',
    subtitle: 'Matriz requisito → documento · página (onde a lei é cumprida)',
    logoBase64: logo,
    date: hoje(),
    meta: [
      `Requisitos no total: ${totalReq}`,
      `Cobertos: ${porEstado.coberto || 0} · Parciais: ${porEstado.parcial || 0} · Planeados: ${porEstado.planeado || 0} · Descobertos: ${porEstado.descoberto || 0}`,
      criticosDescobertos ? `Descobertos de criticidade alta: ${criticosDescobertos}` : null,
      geradoPor ? `Gerado por: ${geradoPor}` : null,
    ].filter(Boolean),
  });

  // ── 1) Cobertura por diploma ────────────────────────────────────────────
  doc.setFontSize(PDF.font.subtitle); doc.setTextColor(...PDF.colors.dark);
  doc.text('Cobertura por diploma', PDF.margin.left, y + 2); y += 6;
  y = addTable(doc, y, {
    columns: [
      { label: 'Diploma', width: 120 },
      { label: 'Requisitos', width: 24, align: 'right' },
      { label: 'Cobertos', width: 22, align: 'right' },
      { label: 'Parcial', width: 20, align: 'right' },
      { label: 'Planeado', width: 22, align: 'right' },
      { label: 'Descobertos (críticos)', width: 40, align: 'right' },
    ],
    rows: cobertura.map(d => [
      d.reservado ? `${d.diploma_codigo} — ${d.diploma_nome} [RESERVADO]` : (d.diploma_nome || d.diploma_codigo),
      String(d.requisitos ?? 0),
      String(d.cobertos ?? 0),
      String(d.parciais ?? 0),
      String(d.planeados ?? 0),
      `${d.descobertos ?? 0}${d.criticos_descobertos ? ` (${d.criticos_descobertos})` : ''}`,
    ]),
  });

  // ── 2) Requisitos por diploma, com a prova ───────────────────────────────
  const porDiploma = new Map();
  for (const r of matriz) {
    if (!porDiploma.has(r.diploma_codigo)) porDiploma.set(r.diploma_codigo, { nome: r.diploma_nome || r.diploma_codigo, reqs: [] });
    porDiploma.get(r.diploma_codigo).reqs.push(r);
  }

  for (const [, grupo] of porDiploma) {
    y = checkPageBreak(doc, y + 6, 40, { logoBase64: logo });
    doc.setFontSize(PDF.font.subtitle); doc.setTextColor(...PDF.colors.dark);
    doc.text(grupo.nome, PDF.margin.left, y); y += 5;
    y = addTable(doc, y, {
      columns: [
        { label: 'Artigo', width: 26 },
        { label: 'Requisito', width: 120 },
        { label: 'Estado', width: 42 },
        { label: 'Prova (documento · página)', width: 80 },
      ],
      rows: grupo.reqs
        .sort((a, b) => String(a.artigo || '').localeCompare(String(b.artigo || ''), 'pt', { numeric: true }))
        .map(r => [
          r.artigo || '—',
          r.titulo + (r.a_reconfirmar ? '  (⚠ a reconfirmar)' : ''),
          ESTADO[r.estado] || r.estado,
          provaTexto(r),
        ]),
      fontSize: PDF.font.small,
    });
  }

  // nota de rodapé honesta: o que o relatório é e o que não é
  y = checkPageBreak(doc, y + 8, 24, { logoBase64: logo });
  doc.setFontSize(PDF.font.caption); doc.setTextColor(...PDF.colors.muted);
  const nota = 'As provas marcadas «sugerido» foram propostas automaticamente por semelhança de texto e carecem de confirmação humana. '
    + 'Os requisitos foram carregados e devem ser conferidos contra os diplomas originais antes de servirem de evidência formal.';
  doc.text(doc.splitTextToSize(nota, doc.internal.pageSize.getWidth() - PDF.margin.left - PDF.margin.right), PDF.margin.left, y + 4);

  addFooter(doc, { generatedBy: geradoPor, systemName: 'Portal de Documentos — SGA' });
  doc.save(`${nomeFicheiro('Relatorio de conformidade')}.pdf`);
}
