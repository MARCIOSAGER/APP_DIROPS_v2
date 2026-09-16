#!/usr/bin/env node
// ============================================================
// Dispatcher dos relatórios automáticos. Roda a cada 15 min (tarefa única
// DIROPS\Relatorios-Dispatcher). Lê a tabela relatorio_agenda e, para cada job
// ativo cujo horário/dia já chegou e que ainda não rodou hoje, dispara o
// gerar-relatorio correspondente e marca ultimo_envio = hoje (idempotência).
//
// Horário/dia/on-off são editáveis na página "Relatórios Automáticos" (sem admin).
// Flag --dry: apenas mostra quais jobs disparariam, sem enviar nem marcar.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dir, '..', '..');
const PGRST = 'http://127.0.0.1:3000';
const SERVICE = fs.readFileSync('C:\\dirops\\sga-onpremise\\secrets\\service_role_key.txt', 'utf8').trim();
const HDR = { Authorization: 'Bearer ' + SERVICE, apikey: SERVICE, 'Content-Type': 'application/json' };
const DRY = process.argv.includes('--dry');

// chave da agenda -> argumentos do gerador
const ARGS = {
  diario: ['--tipo=diario'],
  semanal: ['--tipo=semanal'],
  mensal: ['--tipo=mensal'],
  kpis_semanal: ['--tipo=kpis', '--periodo=semanal'],
  kpis_mensal: ['--tipo=kpis', '--periodo=mensal'],
  pronto_pagamento: [],   // o gerador-pp calcula o período (seg cobre sex→dom)
  chegadas_abertas: [],   // backlog de chegadas sem partida (o gerador calcula tudo)
  docs_a_expirar: [],     // GED: documentos com data_expiracao proxima ou expirada
};
// chave -> script (default gerar-relatorio.mjs). PP e chegadas usam geradores próprios.
const SCRIPT = { pronto_pagamento: 'gerar-relatorio-pp.mjs', chegadas_abertas: 'chegadas-abertas.mjs', docs_a_expirar: 'docs-a-expirar.mjs' };

const pad = (n) => String(n).padStart(2, '0');
const log = (m) => console.log(`[dispatcher ${new Date().toISOString()}]${DRY ? ' (DRY)' : ''} ${m}`);

(async () => {
  const now = new Date();
  const isoDow = now.getDay() === 0 ? 7 : now.getDay();  // Seg=1..Dom=7
  const dom = now.getDate();
  const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  log(`agora=${today} ${hhmm} dow=${isoDow} dom=${dom}`);

  // lockfile: impede instâncias sobrepostas do dispatcher (validade 20 min)
  const LOCK = 'C:\\dirops\\sga-onpremise\\logs\\dispatcher.lock';
  let weOwnLock = false;
  if (!DRY) {
    try {
      if (fs.existsSync(LOCK) && (Date.now() - fs.statSync(LOCK).mtimeMs) / 60000 < 20) {
        log('outra execução do dispatcher em andamento — saindo'); return;
      }
      fs.writeFileSync(LOCK, String(process.pid)); weOwnLock = true;
    } catch (e) { log('aviso lock: ' + e.message); }
  }

  try {
    let jobs;
    try {
      const r = await fetch(`${PGRST}/relatorio_agenda?select=*&ativo=eq.true`, { headers: HDR });
      if (!r.ok) throw new Error(`HTTP ${r.status} — ${await r.text()}`);
      jobs = await r.json();
    } catch (e) { log('ERRO ao ler agenda: ' + e.message); return; }
    if (!Array.isArray(jobs)) { log('agenda inválida'); return; }

    let disparados = 0;
    for (const job of jobs) {
      const jaHoje = job.ultimo_envio === today;
      const horaChegou = hhmm >= (job.hora || '99:99');
      // diaria: se dias_semana estiver definido (CSV ISO 1=Seg..7=Dom), só roda nesses dias; vazio/null = todos.
      const diasDiario = String(job.dias_semana || '').split(',').map((d) => Number(d.trim())).filter(Boolean);
      const diaOk = (job.frequencia !== 'semanal' || Number(job.dia_semana) === isoDow)
                 && (job.frequencia !== 'mensal' || Number(job.dia_mes) === dom)
                 && (job.frequencia !== 'diaria' || diasDiario.length === 0 || diasDiario.includes(isoDow));
      if (!(!jaHoje && horaChegou && diaOk)) { log(`skip ${job.chave} (jaHoje=${jaHoje} horaChegou=${horaChegou} diaOk=${diaOk})`); continue; }

      const base = ARGS[job.chave];
      if (!base) { log(`chave desconhecida: ${job.chave} — ignorado`); continue; }
      const args = [...base];
      // Início da semana configurável na agenda (0=Dom…6=Sáb) — só p/ relatórios semanais.
      if (job.inicio_semana != null && String(job.chave).includes('semanal')) args.push('--inicio-semana=' + job.inicio_semana);
      if (DRY) { disparados++; log(`DISPARARIA ${job.chave} -> ${SCRIPT[job.chave] || 'gerar-relatorio.mjs'} ${args.join(' ')}`); continue; }

      // RESERVA ATÔMICA antes de enviar: marca ultimo_envio=hoje SÓ se ainda != hoje.
      // Se outra execução (tick sobreposto) já reservou, a resposta vem vazia -> NÃO envia.
      // Garante 1 envio/dia mesmo com envios lentos (relay) e ticks concorrentes.
      let claimed = false;
      try {
        const cr = await fetch(`${PGRST}/relatorio_agenda?id=eq.${job.id}&or=(ultimo_envio.is.null,ultimo_envio.neq.${today})`, {
          method: 'PATCH', headers: { ...HDR, Prefer: 'return=representation' },
          body: JSON.stringify({ ultimo_envio: today, updated_date: new Date().toISOString() }),
        });
        const rows = await cr.json();
        claimed = Array.isArray(rows) && rows.length > 0;
      } catch (e) { log(`ERRO ao reservar ${job.chave}: ${e.message} — não envia`); continue; }
      if (!claimed) { log(`${job.chave} já reservado hoje por outra execução — skip (anti-duplicado)`); continue; }

      disparados++;
      log(`disparando ${job.chave} (agendado ${job.hora})...`);
      const script = SCRIPT[job.chave] || 'gerar-relatorio.mjs';
      const res = spawnSync(process.execPath, [path.join(__dir, script), ...args], { cwd: APP_DIR, stdio: 'inherit' });
      log(`${job.chave} concluído exit=${res.status}`);
    }
    log(`fim — ${disparados} job(s) ${DRY ? 'disparariam' : 'disparados'}`);
  } finally {
    if (weOwnLock) { try { fs.unlinkSync(LOCK); } catch { /* ignore */ } }
  }
})().catch((e) => { log('ERRO fatal: ' + e.message); process.exit(1); });
