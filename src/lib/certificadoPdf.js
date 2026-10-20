// Gerador do certificado da Universidade Corporativa DIROPS.
// Frente: logo, nome do aluno, curso, carga horária, nº e assinaturas.
// Verso: plano de aula (temas) + QR code de validação pública (/cert/<token>).
//
// Uso:
//   import { gerarCertificadoPdf } from '@/lib/certificadoPdf';
//   const doc = await gerarCertificadoPdf(cert);   // jsPDF (landscape A4)
//   doc.save(`Certificado_${cert.numero}.pdf`);
//
// cert = {
//   aluno_nome, curso_titulo, carga_horaria, numero, emitido_em (ISO),
//   validacaoUrl, logoDataUrl?,
//   fundoDataUrl?,        // arte/imagem de fundo da FRENTE (full-bleed) — substitui a moldura padrão
//   fundoVersoDataUrl?,   // arte/imagem de fundo do VERSO
//   assinantes: [{ nome, cargo, assinaturaDataUrl? }],
//   plano_aula: [{ tema, horas? }],
// }
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// «DO-2026/0001-7F3A2C»: número + código de verificação (certificados antigos só têm o número).
export const numeroCompleto = (cert) => `${cert?.numero || ''}${cert?.codigo ? '-' + cert.codigo : ''}`;
// Nome de ficheiro sem barras: «Certificado_DO-2026-0001.pdf».
export const nomeFicheiroCertificado = (cert) => `Certificado_${String(cert?.numero || cert?.id || 'certificado').replace(/[\/\\]/g, '-')}.pdf`;

const C = {
  ink: [15, 23, 42],
  navy: [30, 58, 95],
  gold: [161, 130, 58],
  muted: [100, 116, 139],
  faint: [148, 163, 184],
  hair: [214, 199, 160],
};
const sT = (d, c) => d.setTextColor(c[0], c[1], c[2]);
const sD = (d, c) => d.setDrawColor(c[0], c[1], c[2]);

// Cores nomeadas e layout padrão da FRENTE — exportados para o editor visual (Gestão de Formação).
export const CORES_CERT = { ink: C.ink, navy: C.navy, gold: C.gold, muted: C.muted, faint: C.faint, branco: [255, 255, 255], preto: [17, 24, 39] };
// Redacção padrão; cada curso pode sobrepor em certificado_config.textos (ex.: modelo SGA
// "Certifica-se que … frequentou com aproveitamento o treinamento de …").
export const TEXTOS_CERT_DEFAULT = {
  titulo: 'CERTIFICADO',
  eyebrow: 'UNIVERSIDADE CORPORATIVA · SGA',
  intro: 'Certificamos que',
  corpo: 'concluiu com aproveitamento o curso',
  info: 'com a carga horária de {horas} horas  ·  emitido em {data}',
  info_sem_horas: 'emitido em {data}',
  validade: 'Válido até {validade}',
  local: '',
  verso_titulo: 'Conteúdo Programático',
};
export const LAYOUT_FRENTE_DEFAULT = {
    logo:    { x: 50, y: 6,  h: 40 },
    titulo:  { x: 50, y: 25, size: 34, font: 'times', bold: true, align: 'center', cor: 'navy' },
    eyebrow: { x: 50, y: 29, size: 9,  font: 'helvetica', align: 'center', cor: 'gold', track: 3 },
    intro:   { x: 50, y: 38, size: 13, font: 'times', italic: true, align: 'center', cor: 'muted' },
    nome:    { x: 50, y: 48, size: 30, font: 'times', bold: true, align: 'center', cor: 'ink', sublinhado: true },
    corpo:   { x: 50, y: 55, size: 13, font: 'times', align: 'center', cor: 'muted' },
    curso:   { x: 50, y: 62, size: 19, font: 'times', bold: true, align: 'center', cor: 'navy', maxWidth: 78 },
    info:    { x: 50, y: 68, size: 11, font: 'helvetica', align: 'center', cor: 'muted' },
    assinaturas: { y: 84, size: 10, altura: 28, desloc: 0, apos_linha: 13, entrelinha: 11 }, // apos_linha = linha → 1.º texto; entrelinha = função ↔ nome (pt) // altura = imagem da assinatura (pt); desloc = deslocamento vertical da imagem (pt, + desce)
    localdata: { x: 50, y: 74, size: 11, font: 'times', italic: true, align: 'center', cor: 'muted' },
    validade: { x: 50, y: 71, size: 10, font: 'helvetica', align: 'center', cor: 'gold' },
    numero:  { x: 50, y: 95, size: 8, font: 'helvetica', align: 'center', cor: 'faint' },
  };

function fmtData(iso) {
  try {
    const d = new Date(iso || Date.now());
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

export async function gerarCertificadoPdf(cert) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();   // ~842
  const H = doc.internal.pageSize.getHeight();   // ~595
  const M = 34;

  // ───────────────────────── FRENTE ─────────────────────────
  // Arte de fundo personalizada (full-bleed) OU moldura padrão.
  if (cert.fundoDataUrl) {
    try { const pr = doc.getImageProperties(cert.fundoDataUrl); doc.addImage(cert.fundoDataUrl, pr.fileType || 'PNG', 0, 0, W, H, undefined, 'FAST'); } catch { /* arte inválida: segue sem fundo */ }
  } else {
    sD(doc, C.gold); doc.setLineWidth(2.2); doc.rect(M, M, W - 2 * M, H - 2 * M);
    sD(doc, C.hair); doc.setLineWidth(0.8); doc.rect(M + 7, M + 7, W - 2 * M - 14, H - 2 * M - 14);
  }

  // Layout ajustável por item. x,y em % da página; size em pt; align; cor.
  // cert.layout.frente sobrepõe os defaults -> o dono posiciona cada item no editor visual.
  const COR = CORES_CERT;
  const DL = LAYOUT_FRENTE_DEFAULT;
  const Lf = (cert.layout && cert.layout.frente) || {};
  const L = (k) => ({ ...DL[k], ...(Lf[k] || {}) });
  const PX = (xp) => (W * xp) / 100;
  const PY = (yp) => (H * yp) / 100;
  const drawText = (k, texto) => {
    const it = L(k); if (texto == null || texto === '' || it.hidden) return it;
    doc.setFont(it.font || 'helvetica', it.italic ? 'italic' : (it.bold ? 'bold' : 'normal'));
    doc.setFontSize(it.size); sT(doc, COR[it.cor] || C.ink);
    if (it.track) {
      // Com espaçamento entre letras o jsPDF centra pela largura SEM o espaçamento -> o texto sai deslocado para a
      // direita. Calcula-se a largura real (letras + espaçamento entre elas) e desenha-se alinhado à esquerda.
      const s = String(texto);
      const w = doc.getTextWidth(s) + it.track * Math.max(0, s.length - 1);
      const al = it.align || 'center';
      const x0 = al === 'center' ? PX(it.x) - w / 2 : al === 'right' ? PX(it.x) - w : PX(it.x);
      doc.setCharSpace(it.track);
      doc.text(s, x0, PY(it.y));
      doc.setCharSpace(0);
      return it;
    }
    doc.text(String(texto), PX(it.x), PY(it.y), { align: it.align || 'center', maxWidth: it.maxWidth ? PX(it.maxWidth) : undefined });
    return it;
  };

  // Logo
  { const it = L('logo'); if (cert.logoDataUrl && !it.hidden) { try { const pr = doc.getImageProperties(cert.logoDataUrl); const ratio = pr.width / pr.height; let lh = it.h || 40, lw = lh * ratio; if (lw > 170) { lw = 170; lh = lw / ratio; } doc.addImage(cert.logoDataUrl, pr.fileType || 'PNG', PX(it.x) - lw / 2, PY(it.y), lw, lh, undefined, 'FAST'); } catch { /* */ } } }

  // Frases configuráveis por curso (cert.textos) — defaults = redacção padrão da plataforma.
  // Placeholders em qualquer texto: {nome} {curso} {horas} {data} {numero} {local}.
  // `local` gera ainda a linha "Local, data" (item 'localdata').
  const T = Object.assign({}, TEXTOS_CERT_DEFAULT, cert.textos || {});
  const dataEmissao = fmtData(cert.emitido_em);
  const subst = (t) => String(t == null ? '' : t)
    .replace(/\{nome\}/g, cert.aluno_nome || '')
    .replace(/\{curso\}/g, cert.curso_titulo || '')
    .replace(/\{horas\}/g, String(cert.carga_horaria || ''))
    .replace(/\{data\}/g, dataEmissao)
    .replace(/\{numero\}/g, numeroCompleto(cert))
    .replace(/\{local\}/g, T.local || '')
    .replace(/\{validade\}/g, cert.valido_ate ? fmtData(cert.valido_ate) : '');
  drawText('titulo', subst(T.titulo));
  drawText('eyebrow', subst(T.eyebrow));
  drawText('intro', subst(T.intro));
  { const it = drawText('nome', cert.aluno_nome || '—'); if (it.sublinhado && cert.aluno_nome) { doc.setFont(it.font || 'times', 'bold'); doc.setFontSize(it.size); const w = Math.min(W - 80, doc.getTextWidth(cert.aluno_nome) + 60); sD(doc, C.hair); doc.setLineWidth(0.8); doc.line(PX(it.x) - w / 2, PY(it.y) + 8, PX(it.x) + w / 2, PY(it.y) + 8); } }
  drawText('corpo', subst(T.corpo));
  drawText('curso', cert.curso_titulo || '—');
  drawText('info', subst(cert.carga_horaria ? T.info : T.info_sem_horas));
  drawText('localdata', T.local ? `${T.local}, ${dataEmissao}` : '');
  drawText('validade', cert.valido_ate ? subst(T.validade) : '');

  // Caixas de texto livres criadas no editor visual (layout.frente.extras).
  for (const ex of (Array.isArray(Lf.extras) ? Lf.extras : [])) {
    if (!ex || ex.hidden || !ex.texto) continue;
    const it = { x: 50, y: 50, size: 12, font: 'helvetica', align: 'center', cor: 'ink', ...ex };
    doc.setFont(it.font || 'helvetica', it.italic ? (it.bold ? 'bolditalic' : 'italic') : (it.bold ? 'bold' : 'normal'));
    doc.setFontSize(it.size); sT(doc, COR[it.cor] || C.ink);
    doc.text(subst(it.texto).split(/\r?\n/), PX(it.x), PY(it.y), { align: it.align || 'center', maxWidth: it.maxWidth ? PX(it.maxWidth) : undefined, lineHeightFactor: 1.25 });
  }

  // Assinaturas (2 a 4) — a linha é centrada; a altura vem do layout.
  const ass = (Array.isArray(cert.assinantes) ? cert.assinantes : []).slice(0, 4);
  if (ass.length) {
    const sit = L('assinaturas'); const sigY = PY(sit.y);
    const slotW = 190; const gap = 30; const totalW = ass.length * slotW + (ass.length - 1) * gap;
    let sx = W / 2 - totalW / 2;
    for (const [iAss, a] of ass.entries()) {
      const cx = sx + slotW / 2;
      // ajustes individuais (por posição na fila) sobrepõem-se aos globais
      const indAss = (sit.individual || {})[iAss] || {};
      const altAss = Math.min(120, Math.max(10, Number(indAss.altura ?? sit.altura) || 28));
      const descAss = Number(indAss.desloc ?? sit.desloc) || 0;
      const dxAss = Number(indAss.dx) || 0; // deslocamento horizontal individual (pt)
      if (a.assinaturaDataUrl) { try { const pr = doc.getImageProperties(a.assinaturaDataUrl); const r = pr.width / pr.height; let hh = altAss, ww = hh * r; const maxW = slotW * 1.4; if (ww > maxW) { ww = maxW; hh = ww / r; } doc.addImage(a.assinaturaDataUrl, pr.fileType || 'PNG', cx - ww / 2 + dxAss, sigY - hh - 2 + descAss, ww, hh, undefined, 'FAST'); } catch { /* */ } }
      sD(doc, C.ink); doc.setLineWidth(0.8); doc.line(sx + 12, sigY, sx + slotW - 12, sigY);
      // Ordem sob a linha: nome/cargo (padrão) ou cargo/nome (modelo SGA: cert.assinatura_cargo_acima).
      const aposLinha = Number(sit.apos_linha) || 13, entrelinha = Number(sit.entrelinha) || 11;
      const yNome = cert.assinatura_cargo_acima && a.cargo ? sigY + aposLinha + entrelinha : sigY + aposLinha;
      const yCargo = cert.assinatura_cargo_acima ? sigY + aposLinha : sigY + aposLinha + entrelinha;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(sit.size || 10); sT(doc, C.ink); doc.text(a.nome || '', cx, yNome, { align: 'center' });
      if (a.cargo) { doc.setFont('helvetica', 'normal'); doc.setFontSize((sit.size || 10) - 2); sT(doc, C.muted); doc.text(a.cargo, cx, yCargo, { align: 'center' }); }
      sx += slotW + gap;
    }
  }

  drawText('numero', `Certificado nº ${numeroCompleto(cert)}`);

  // ───────────────────────── VERSO ─────────────────────────
  doc.addPage('a4', 'landscape');
  if (cert.fundoVersoDataUrl) {
    try { const pr = doc.getImageProperties(cert.fundoVersoDataUrl); doc.addImage(cert.fundoVersoDataUrl, pr.fileType || 'PNG', 0, 0, W, H, undefined, 'FAST'); } catch { /* */ }
  } else {
    sD(doc, C.gold); doc.setLineWidth(1.6); doc.rect(M, M, W - 2 * M, H - 2 * M);
  }

  doc.setFont('times', 'bold'); doc.setFontSize(20); sT(doc, C.navy);
  doc.text(T.verso_titulo || 'Conteúdo Programático', M + 24, M + 40);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); sT(doc, C.muted);
  doc.text([cert.curso_titulo, cert.carga_horaria ? `${cert.carga_horaria} horas` : ''].filter(Boolean).join('  ·  '), M + 24, M + 58);
  sD(doc, C.hair); doc.setLineWidth(0.8); doc.line(M + 24, M + 66, W - M - 24, M + 66);

  const temas = Array.isArray(cert.plano_aula) ? cert.plano_aula : [];
  let ty = M + 90; const colRight = W - M - 200; // deixa espaço à direita para o QR
  doc.setFontSize(11);
  if (temas.length === 0) {
    doc.setFont('helvetica', 'italic'); sT(doc, C.faint);
    doc.text('Plano de aula não especificado.', M + 24, ty);
  } else {
    temas.forEach((t, i) => {
      if (ty > H - M - 40) return; // não transborda a página
      doc.setFont('helvetica', 'bold'); sT(doc, C.gold); doc.setFontSize(11);
      doc.text(String(i + 1).padStart(2, '0'), M + 24, ty);
      doc.setFont('helvetica', 'normal'); sT(doc, C.ink);
      doc.text(String(t.tema || t.titulo || t), M + 48, ty, { maxWidth: colRight - (M + 48) });
      if (t.horas) { doc.setFont('helvetica', 'normal'); sT(doc, C.muted); doc.setFontSize(9); doc.text(`${t.horas} h`, colRight, ty, { align: 'right' }); }
      ty += 20;
    });
  }

  // QR de validação (canto inferior direito)
  const qrUrl = cert.validacaoUrl || '';
  if (qrUrl) {
    try {
      const qr = await QRCode.toDataURL(qrUrl, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
      const qs = 110; const qx = W - M - 24 - qs; const qy = H - M - 24 - qs;
      doc.addImage(qr, 'PNG', qx, qy, qs, qs, undefined, 'FAST');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); sT(doc, C.muted);
      doc.text('Validar autenticidade', qx + qs / 2, qy - 6, { align: 'center' });
      doc.setFontSize(7); sT(doc, C.faint);
      doc.text(cert.numero || '', qx + qs / 2, qy + qs + 10, { align: 'center' });
    } catch { /* sem QR */ }
  }

  return doc;
}
