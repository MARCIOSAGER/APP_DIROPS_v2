#!/usr/bin/env node
// ============================================================
// Ficha de Inspeção de Pista — gera um PDF AGRUPADO POR CATEGORIA (sumário no
// topo + mini-resumo por categoria + badges de resultado + plano de ação) e
// envia por email. Por omissão gera um EXEMPLO com os 27 itens reais do checklist
// (tipo PISTA_DIARIA) e resultados ilustrativos, para validar o layout da ficha.
//
// Flags: --to=a@x  (destinatário; default oaeroportos@sga.co.ao)
//        --dry     (não envia; grava o PDF em %TEMP%)
// ============================================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dir = path.dirname(fileURLToPath(import.meta.url));
let LOGO = null; const LOGO_RATIO = 512 / 207;
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dir, '..', '..', 'public', 'logo-sga.png')).toString('base64'); } catch { LOGO = null; }

const PGRST = 'http://127.0.0.1:3000';
const FUNCTIONS = 'http://127.0.0.1:4001';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const TIPO = '19097623-0773-5c8d-875d-ac7c91d4e9a4'; // PISTA_DIARIA

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const TO = args.to || 'oaeroportos@sga.co.ao';
const DRY = !!args.dry;

const hoje = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = `${String(hoje.getDate()).padStart(2, '0')} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;

// Resultados de EXEMPLO por ordem (ilustrativos: alguns NC c/ plano, um N.A.)
const SAMPLE = {
  4:  { r: 'nao_conforme', obs: 'Tinta desgastada no troço central; visibilidade reduzida à chuva.', acao: 'Repintar a sinalização horizontal do eixo.', prazo: '30 dias', resp: 'Manutenção', fotos: 2 },
  9:  { r: 'nao_aplicavel' },
  12: { r: 'nao_conforme', obs: '2 luzes de aproximação fundidas no lado esquerdo.', acao: 'Substituir as lâmpadas fundidas.', prazo: '7 dias', resp: 'Elétrica/AVSEC', fotos: 3 },
  22: { r: 'nao_conforme', obs: 'Presença de aves junto à cabeceira; risco de colisão.', acao: 'Acionar o plano de dispersão de fauna.', prazo: 'Imediato', resp: 'Operações', fotos: 1 },
};
const resultadoDe = (ordem) => SAMPLE[ordem] || { r: 'conforme' };

async function fetchItens() {
  const r = await fetch(`${PGRST}/item_checklist?tipo_inspecao_id=eq.${TIPO}&status=eq.ativo&select=ordem,categoria,item,criterio&order=ordem.asc`, { headers: HDR });
  if (!r.ok) throw new Error(`itens: HTTP ${r.status} — ${await r.text()}`);
  return await r.json();
}

// -------------------- PDF (retrato, agrupado por categoria) --------------------
function gerarPdf(itens) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
  const M = 40, CW = PW - 2 * M; let y = 0;
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const sane = (s) => String(s == null ? '' : s).replace(/—/g, '-').replace(/[^\x00-\xFF]/g, '?');
  const C = { primary: [15, 47, 95], green: [5, 150, 105], red: [185, 28, 28], grey: [100, 116, 139], amber: [217, 119, 6], ink: [15, 23, 42], text: [51, 65, 85], muted: [100, 116, 139], line: [226, 232, 240], soft: [248, 250, 252] };
  const META = { conforme: { l: 'Conforme', c: C.green }, nao_conforme: { l: 'Não Conforme', c: C.red }, nao_aplicavel: { l: 'N.A.', c: C.grey } };

  function header() {
    const topY = 30, logoH = 32, logoW = logoH * LOGO_RATIO;
    if (LOGO) { try { doc.addImage(LOGO, 'PNG', M, topY, logoW, logoH); } catch { /* */ } }
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Ficha de Inspeção Diária de Pista', PW - M, topY + 10, { align: 'right' });
    setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('EXEMPLO / Pré-visualização', PW - M, topY + 26, { align: 'right' });
    const ly = topY + logoH + 12; setDraw(C.primary); doc.setLineWidth(2); doc.line(M, ly, PW - M, ly); y = ly + 16;
  }
  function newPage() { doc.addPage(); header(); }
  function brk(n) { if (y + n > PH - 46) newPage(); }
  header();

  // ---- Dados Gerais (exemplo) ----
  const gerais = [['Aeroporto', 'FNMO — Welwitschia Mirabilis'], ['Data', dataExtenso], ['Turno', 'A (Diurno)'], ['Hora UTC', '06:00'], ['Inspetor', '(exemplo)'], ['OPA em serviço', '(exemplo)']];
  const dgH = 66;
  setFill(C.soft); setDraw(C.line); doc.setLineWidth(0.8); doc.roundedRect(M, y, CW, dgH, 6, 6, 'FD');
  gerais.forEach((g, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = M + 16 + col * (CW / 3);
    const cy = y + 20 + row * 28;
    setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text(sane(g[0].toUpperCase()), x, cy);
    setText(C.ink); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(sane(g[1]), x, cy + 12);
  });
  y += dgH + 18;

  // ---- Condições da Pista (GRF) — logo após os dados gerais (informação-chave) ----
  const grf = [['08', '6/6/6', 'NR/NR/NR', 'NR/NR/NR', 'DRY/DRY/DRY'], ['26', '6/6/6', 'NR/NR/NR', 'NR/NR/NR', 'DRY/DRY/DRY']];
  setText(C.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Condições da Pista (GRF)', M, y); y += 8;
  const gc = [{ t: 'Pista', w: 55 }, { t: 'RWYCC', w: 85 }, { t: '% Troço', w: 115 }, { t: 'Lâmina', w: 115 }, { t: 'Condição', w: CW - (55 + 85 + 115 + 115) }];
  const grh = 18;
  setFill(C.primary); doc.rect(M, y, CW, grh, 'F'); setText([203, 213, 225]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  let gx = M; gc.forEach((c) => { doc.text(sane(c.t.toUpperCase()), gx + 8, y + 12); gx += c.w; }); y += grh;
  grf.forEach((r, ri) => {
    if (ri % 2 === 0) { setFill(C.soft); doc.rect(M, y, CW, grh, 'F'); }
    let cx = M; r.forEach((v, ci) => { setText(ci === 0 ? C.ink : C.text); doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal'); doc.setFontSize(9); doc.text(sane(v), cx + 8, y + 12); cx += gc[ci].w; });
    setDraw(C.line); doc.setLineWidth(0.5); doc.line(M, y + grh, M + CW, y + grh); y += grh;
  });
  y += 18;

  // ---- Resumo (contagens) ----
  const tot = itens.length;
  const nc = itens.filter((it) => resultadoDe(it.ordem).r === 'nao_conforme').length;
  const na = itens.filter((it) => resultadoDe(it.ordem).r === 'nao_aplicavel').length;
  const conf = tot - nc - na;
  const pills = [['ITENS', String(tot), C.primary], ['CONFORMES', String(conf), C.green], ['NÃO CONFORMES', String(nc), C.red], ['N.A.', String(na), C.grey]];
  const pw = (CW - 3 * 8) / 4;
  pills.forEach((p, i) => {
    const x = M + i * (pw + 8);
    setFill(C.soft); setDraw(C.line); doc.setLineWidth(0.8); doc.roundedRect(x, y, pw, 34, 6, 6, 'FD');
    setFill(p[2]); doc.roundedRect(x + 8, y + 8, 3.5, 18, 2, 2, 'F');
    setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text(sane(p[0]), x + 16, y + 13);
    setText(p[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(p[1], x + 16, y + 28);
  });
  y += 34 + 18;

  // ---- Itens agrupados por categoria ----
  const cats = [];
  for (const it of itens) { let g = cats.find((c) => c.nome === it.categoria); if (!g) { g = { nome: it.categoria, itens: [] }; cats.push(g); } g.itens.push(it); }
  const bottom = PH - 50;

  // cabecalho de categoria (repete no topo da pagina quando a categoria continua)
  const drawCatHeader = (cat, cont) => {
    const catNC = cat.itens.filter((it) => resultadoDe(it.ordem).r === 'nao_conforme').length;
    setFill(C.primary); doc.roundedRect(M, y, CW, 20, 4, 4, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(sane(cat.nome) + (cont ? '  (continuação)' : ''), M + 10, y + 13);
    setText([203, 213, 225]); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`${cat.itens.length} item(ns)${catNC ? ` · ${catNC} não conforme(s)` : ''}`, M + CW - 10, y + 13, { align: 'right' });
    y += 20 + 12;
  };

  // mede a altura total de um item (p/ decidir quebras sem partir o item nem orfanar o header)
  const medir = (it) => {
    const res = resultadoDe(it.ordem);
    const meta = META[res.r] || META.conforme;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    const bw = doc.getTextWidth(meta.l) + 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    const itemLines = doc.splitTextToSize(sane(`${it.ordem}. ${it.item}`), CW - bw - 14);
    const critLines = it.criterio ? doc.splitTextToSize(sane('Critério: ' + it.criterio), CW) : [];
    const obsLines = res.obs ? doc.splitTextToSize(sane('Obs.: ' + res.obs), CW - 6) : [];
    const planoWl = [];
    if (res.r === 'nao_conforme' && res.acao) {
      [`Ação: ${res.acao}`, `Prazo: ${res.prazo || '-'}      Responsável: ${res.resp || '-'}`].forEach((l) => doc.splitTextToSize(sane(l), CW - 18).forEach((x) => planoWl.push(x)));
    }
    const planoH = planoWl.length ? planoWl.length * 11 + 18 : 0;
    const nFotos = res.fotos || 0;
    const fotosH = nFotos ? Math.ceil(nFotos / 6) * 50 + 18 : 0;
    const h = Math.max(itemLines.length * 13, 16) + 9 + (critLines.length ? critLines.length * 10 + 5 : 0) + (obsLines.length ? obsLines.length * 12 + 8 : 0) + (planoH ? planoH + 10 : 0) + (fotosH ? fotosH + 2 : 0) + 18;
    return { res, meta, bw, itemLines, critLines, obsLines, planoWl, planoH, nFotos, fotosH, h };
  };

  for (const cat of cats) {
    // header + PRIMEIRO item têm de caber juntos (32 = altura do header); senão o
    // header ficava órfão no fim da pagina (o vazio da "Sinalização Nocturna").
    if (y + 32 + medir(cat.itens[0]).h > bottom) newPage();
    drawCatHeader(cat, false);

    for (const it of cat.itens) {
      const mi = medir(it);
      if (y + mi.h > bottom) { newPage(); drawCatHeader(cat, true); }

      const rowTop = y, bx = M + CW - mi.bw;
      // badge (direita, alinhado com a 1.ª linha)
      setFill(mi.meta.c); doc.roundedRect(bx, rowTop, mi.bw, 14, 3, 3, 'F');
      setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(mi.meta.l, bx + 7, rowTop + 9);
      // item (esquerda)
      setText(C.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(mi.itemLines, M, rowTop + 10); y = rowTop + Math.max(mi.itemLines.length * 13, 14) + 9;
      // critério
      if (mi.critLines.length) { setText(C.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.text(mi.critLines, M, y); y += mi.critLines.length * 10 + 5; }
      // observações
      if (mi.obsLines.length) { setText(C.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(mi.obsLines, M, y); y += mi.obsLines.length * 12 + 8; }
      // plano de ação (NC)
      if (mi.planoH) {
        setFill([254, 242, 242]); setDraw(C.red); doc.setLineWidth(0.5); doc.roundedRect(M, y, CW, mi.planoH, 3, 3, 'FD');
        setText(C.red); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('PLANO DE AÇÃO', M + 8, y + 11);
        setText(C.ink); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(mi.planoWl, M + 8, y + 22); y += mi.planoH + 10;
      }
      // fotos (inline, abaixo do item respetivo — miniaturas em linha)
      if (mi.nFotos) {
        setText(C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(sane(`Fotos (${mi.nFotos}):`), M, y + 2); y += 8;
        const tw = 66, th = 44, gap = 8; let fx = M;
        for (let i = 0; i < mi.nFotos; i++) {
          if (fx + tw > M + CW) { fx = M; y += th + gap; }
          setFill([234, 239, 245]); setDraw(C.line); doc.setLineWidth(0.5); doc.roundedRect(fx, y, tw, th, 3, 3, 'FD');
          setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('Foto ' + (i + 1), fx + tw / 2, y + th / 2 + 2, { align: 'center' });
          fx += tw + gap;
        }
        y += th + 10;
      }
      // separador + respiro entre itens
      setDraw(C.line); doc.setLineWidth(0.5); doc.line(M, y + 6, M + CW, y + 6); y += 18;
    }
    y += 14; // respiro entre categorias
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setText(C.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('EXEMPLO — ficha gerada pelo Sistema DIROPS-SGA (dados ilustrativos p/ validar o layout)', M, PH - 24);
    doc.text(`Página ${p}/${total}`, PW - M, PH - 24, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer')).toString('base64');
}

function buildHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:20px;">
  <div style="background:#fff;border-radius:12px;padding:24px 32px;border:1px solid #e2e8f0;border-top:3px solid #1e3a5f;color:#0f172a;">
    <img src="cid:sgalogo" alt="SGA" height="40" style="display:block;border:0;margin-bottom:14px;">
    <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:18px;">Ficha de Inspeção de Pista — Exemplo</h2>
    <p style="font-size:13px;color:#334155;line-height:1.5;margin:0 0 12px;">
      Segue em anexo um <strong>exemplo da ficha digital</strong> de Inspeção Diária de Pista, com os
      <strong>27 itens</strong> agrupados por categoria (Pavimentos · Sinalização Nocturna · Equipamentos/Outros · FOD's),
      sumário de conformidades e planos de ação. Os resultados são <strong>ilustrativos</strong>, só para validar o formato.
    </p>
    <p style="font-size:12px;color:#64748b;margin:0;">Gerado automaticamente pelo Sistema DIROPS-SGA · ${dataExtenso}</p>
  </div>
</div></body></html>`;
}

async function sendOne(to, subject, html, anexos) {
  const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ to, subject, html, ...(anexos?.length ? { attachments: anexos } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success, status: r.status, error: j.error };
}

(async () => {
  const itens = await fetchItens();
  if (!itens.length) throw new Error('Sem itens ativos para o tipo PISTA_DIARIA (correr a migr 086?)');
  const pdf = gerarPdf(itens);
  const anexos = [{ filename: `Ficha_Inspecao_Pista_EXEMPLO_${iso(hoje)}.pdf`, content: pdf, encoding: 'base64', contentType: 'application/pdf' }];
  const hhmmss = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}:${String(hoje.getSeconds()).padStart(2, '0')}`;
  const assunto = `DIROPS — Ficha de Inspeção de Pista (EXEMPLO ${hhmmss}) — ${iso(hoje)}`;

  if (DRY) {
    const p = path.join(os.tmpdir(), anexos[0].filename);
    fs.writeFileSync(p, Buffer.from(pdf, 'base64'));
    console.log(`[ficha] (DRY) ${itens.length} itens · PDF salvo em: ${p} (${Math.round(pdf.length * 0.75 / 1024)} KB)`);
    return;
  }
  const res = await sendOne(TO, assunto, buildHtml(), anexos);
  console.log(res.ok ? `[ficha] enviado para ${TO} (${itens.length} itens, PDF ${Math.round(pdf.length * 0.75 / 1024)} KB)` : `[ficha] FALHA: HTTP ${res.status} ${res.error || ''}`);
  if (!res.ok) process.exit(1);
})().catch((e) => { console.error('[ficha] ERRO:', e?.message || e); process.exit(1); });
