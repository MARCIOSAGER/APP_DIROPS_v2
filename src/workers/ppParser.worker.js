// Web Worker: parse do .xls de Facturação Tráfego PP fora do main-thread.
// XLSX.read + sheet_to_json + montagem/dedup são síncronos e pesados (dezenas
// de milhares de linhas) — na thread principal congelavam a aba durante o upload.
// A LÓGICA DE PARSE É IDÊNTICA à que estava em ProntoPagamento.handleFile
// (calibrada para bater com o Power BI): não alterar sem re-validar com ficheiro real.
import * as XLSX from 'xlsx';

const COLS = [
  'num_movimento', 'data_movimento', 'status', 'cod_cliente', 'nome_cliente', 'num_nota_preco',
  'data_nota_preco', 'num_factura', 'data_factura', 'valor_total', 'divisa', 'cambio', 'valor_total_akz',
  'servico', 'descricao', 'valor_linha', 'valor_linha_akz', 'diario_ctb', 'num_reg_ctb', 'diario_banco',
  'num_reg_banco', 'data_pagamento', 'cod_banco', 'nome_banco', 'num_doc_banco', 'divisa_banco', 'utilizador_criacao',
];
const NUM_IDX = new Set([9, 11, 12, 15, 16]);
const DATE_IDX = new Set([1, 6, 8, 21]);
const pad2 = (n) => String(n).padStart(2, '0');
function serialToDMY(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} 00:00`;
}
function num(s) {
  s = String(s ?? '').trim();
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

self.onmessage = (e) => {
  const { buffer, hoje, userEmail, fileName } = e.data || {};
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // NÚMEROS: ler formatado ("124,9098") e parsear com num() — o .xls guarda inteiros
    // escalados (124,9098 → 1249098), então o raw dá valor errado.
    // DATAS: ler raw (serial do Excel) — o formatado é ambíguo (M/D vs D/M).
    const rowsFmt = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const seen = new Set();
    const out = [];
    for (let ri = 2; ri < rowsFmt.length; ri++) {
      const rf = rowsFmt[ri] || [], rr = rowsRaw[ri] || [];
      if (!rf.some(c => String(c ?? '').trim())) continue;
      const obj = {};
      COLS.forEach((c, i) => {
        if (DATE_IDX.has(i)) { const s = rr[i]; obj[c] = (typeof s === 'number') ? serialToDMY(s) : (String(rf[i] ?? '').trim() || null); }
        else if (NUM_IDX.has(i)) obj[c] = num(String(rf[i] ?? ''));
        else obj[c] = String(rf[i] ?? '').trim() || null;
      });
      const key = [obj.num_movimento, obj.servico, obj.status, obj.num_factura, obj.num_nota_preco, obj.valor_linha, obj.valor_linha_akz].join('|');
      if (seen.has(key)) continue; seen.add(key);
      obj.upload_date = hoje; obj.uploaded_by = userEmail || null; obj.source_file = fileName;
      out.push(obj);
    }
    const pp = out.filter(r => r.status === 'PP').length;
    const movs = new Set(out.map(r => r.num_movimento)).size;
    self.postMessage({ ok: true, out, pp, movs });
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || 'Falha ao processar o ficheiro.' });
  }
};
