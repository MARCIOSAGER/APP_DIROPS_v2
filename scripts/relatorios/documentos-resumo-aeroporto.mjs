#!/usr/bin/env node
// ============================================================
// Portal de Documentos — resumo diário AO DIRECTOR DE CADA AEROPORTO.
//
// Um email global com tudo o que falta em 23 aeroportos não é lido por ninguém: cada director recebe apenas o
// que está em falta no SEU aeroporto, e cada linha diz o que fazer. Quem não tem nada em falta não recebe email.
//
// O que entra no resumo (tudo com acção e prazo):
//   1. Confirmações de emenda em atraso ou a vencer  — Instrutivo 22C.107.001.A, Apêndice 1 §1.5 (30 dias);
//   2. Leituras por confirmar nos documentos que as exigem (migração 141);
//   3. Documentos expirados ou a expirar nos próximos 30 dias;
//   4. Documentos sem par de revisão — a linha do tempo das revisões não responde por hoje (migração 152):
//      é a pergunta «que revisão estava em vigor no dia X?» a ficar sem resposta;
//   5. Ficheiros repetidos à espera de decisão (pares com o mesmo SHA-256, migração 152).
//
// Um email por aeroporto, ao seu responsável, com o endereço em To — o relay da SGA só entrega a @sga.co.ao e
// trata BCC/massa como spam. Um director que responda por dois aeroportos recebe dois emails, um por aeroporto:
// é o que lhe permite encaminhar cada um para a equipa certa.
//
// Anti-duplicado em documento_aviso_enviado (migração 165): chave resumo_aeroporto:<aero>:<email>:<data>, uma vez
// por dia, mesmo com o despachante a passar de 15 em 15 minutos.
//
// Flags: --dry (não envia nem grava)  --so=<email>  --icao=FNMO (só um aeroporto)  --exemplo (só com --dry)
// ============================================================
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DRY, EXEMPLO, SO, flags, HOJE_ISO, carregarContexto, registoPronto, avisar, entregavel, emendasDeExemplo,
  esc, dataPt, diasAte, layout, acao, seccao, ligaDoc, plural, PORTAL_URL,
} from './_documentos-comum.mjs';

const JANELA_VALIDADE = 30;        // dias
const MAX_LINHAS = 15;             // por bloco; o resto fica no portal
const ICAO = flags.icao ? String(flags.icao).toUpperCase() : null;
const log = (m) => console.log(`[docs-resumo]${DRY ? ' (DRY)' : ''} ${m}`);

// ---------- o que está em falta num aeroporto ----------
function pendencias(ctx, aero) {
  const docsDoAero = ctx.docs.filter(d => ctx.aeroportoDoDoc(d) === aero.id);
  const emVigor = docsDoAero.filter(d => (d.estado || 'em_vigor') === 'em_vigor');

  // 1) emendas: quem falta confirmar, por emenda
  const emendas = [];
  for (const e of ctx.emendas.filter(x => x.aeroporto_id === aero.id)) {
    const doc = ctx.docs.find(d => d.id === e.documento_id); if (!doc) continue;
    const faltam = ctx.detentores(doc).filter(p => !ctx.confirmado.has(`${e.emenda_id}|${p.email}`));
    if (faltam.length) emendas.push({ e, doc, faltam });
  }
  emendas.sort((a, b) => (a.e.dias_restantes ?? 0) - (b.e.dias_restantes ?? 0));

  // 2) leituras por confirmar («Li e tomei conhecimento»)
  const leituras = [];
  for (const d of emVigor.filter(x => x.exige_leitura)) {
    const faltam = ctx.detentores(d).filter(p => !ctx.lido.has(`${d.id}|${p.email}`));
    if (faltam.length) leituras.push({ d, faltam });
  }
  leituras.sort((a, b) => b.faltam.length - a.faltam.length);

  // 3) validade
  const validade = emVigor
    .map(d => ({ d, faltam: diasAte(ctx.expiraEm(d)) }))
    .filter(x => x.faltam !== null && x.faltam <= JANELA_VALIDADE)
    .sort((a, b) => a.faltam - b.faltam);

  // 4) sem par de revisão
  const semPar = emVigor.map(d => ({ d, motivo: ctx.semParDeRevisao(d) })).filter(x => x.motivo);

  // 5) ficheiros repetidos sem decisão
  const idsDoAero = new Set(docsDoAero.map(d => d.id));
  const repetidos = ctx.duplicados.filter(p => !p.decisao_id && (idsDoAero.has(p.documento_id) || idsDoAero.has(p.par_id)));

  const total = emendas.length + leituras.length + validade.length + semPar.length + repetidos.length;
  const emAtraso = emendas.filter(x => (x.e.dias_restantes ?? 0) < 0).length;
  const expirados = validade.filter(x => x.faltam < 0).length;
  return { docsDoAero, emendas, leituras, validade, semPar, repetidos, total, emAtraso, expirados };
}

// ---------- o email ----------
function montar(ctx, aero, resp, p) {
  const urgente = p.emAtraso > 0 ? `${plural(p.emAtraso, 'confirmação de emenda', 'confirmações de emenda')} com o prazo já ultrapassado`
    : p.expirados > 0 ? `${plural(p.expirados, 'documento expirado', 'documentos expirados')}`
    : p.emendas.length ? `${plural(p.emendas.length, 'emenda', 'emendas')} à espera de confirmação`
    : p.validade.length ? `${plural(p.validade.length, 'documento', 'documentos')} com a validade a terminar`
    : p.leituras.length ? `${plural(p.leituras.length, 'documento', 'documentos')} com leituras por confirmar`
    : p.semPar.length ? `${plural(p.semPar.length, 'documento', 'documentos')} sem par de revisão`
    : `${plural(p.repetidos.length, 'par de ficheiros repetidos', 'pares de ficheiros repetidos')} por decidir`;

  const assunto = `${aero.codigo_icao} — ${plural(p.total, 'pendência', 'pendências')} nos documentos do seu aeroporto`;

  const corpo = acao(`<strong>Prioridade de hoje:</strong> ${esc(urgente)}.<br>
      <strong>O que tem de fazer:</strong> abrir cada linha abaixo no portal e resolver ou delegar; as confirmações
      em atraso primeiro, porque são as únicas que já estão fora de prazo.<br>
      <strong>Até quando:</strong> as confirmações em atraso, esta semana; o resto, antes da data indicada em cada linha.`)

    + seccao({
      titulo: 'Confirmações de emenda', cor: p.emAtraso ? '#b91c1c' : '#b45309',
      intro: `Prazo de confirmação do detentor (30 dias, Instrutivo 22C.107.001.A). Negativo = fora de prazo.`,
      colunas: ['Documento', 'Emenda', 'Prazo', 'Em falta'],
      linhas: p.emendas.slice(0, MAX_LINHAS).map(({ e, doc, faltam }) => {
        const dr = e.dias_restantes ?? 0;
        return [
          ligaDoc(doc),
          `nº ${e.numero}${e.tipo === 'corrigenda' ? ' (corrigenda)' : ''}<br><span style="font-size:12px;color:#64748b">distribuída ${dataPt(e.distribuida_em)}</span>`,
          dr < 0 ? `<span style="color:#b91c1c">${dataPt(e.prazo_em)}<br>há ${plural(-dr, 'dia', 'dias')}</span>` : `${dataPt(e.prazo_em)}<br><span style="font-size:12px;color:#64748b">faltam ${plural(dr, 'dia', 'dias')}</span>`,
          `${plural(faltam.length, 'pessoa', 'pessoas')}<br><span style="font-size:12px;color:#64748b">${esc(faltam.slice(0, 4).map(x => x.nome).join(', '))}${faltam.length > 4 ? ` e mais ${faltam.length - 4}` : ''}</span>`,
        ];
      }),
      mais: Math.max(p.emendas.length - MAX_LINHAS, 0),
    })

    + seccao({
      titulo: 'Leituras por confirmar', cor: '#b45309',
      intro: 'Documentos em vigor que exigem «Li e tomei conhecimento» e ainda têm pessoas em falta.',
      colunas: ['Documento', 'Em vigor desde', 'Em falta'],
      linhas: p.leituras.slice(0, MAX_LINHAS).map(({ d, faltam }) => [
        ligaDoc(d), dataPt(d.em_vigor_desde || d.publicacao_em),
        `${plural(faltam.length, 'pessoa', 'pessoas')}<br><span style="font-size:12px;color:#64748b">${esc(faltam.slice(0, 4).map(x => x.nome).join(', '))}${faltam.length > 4 ? ` e mais ${faltam.length - 4}` : ''}</span>`,
      ]),
      mais: Math.max(p.leituras.length - MAX_LINHAS, 0),
    })

    + seccao({
      titulo: 'Validade a terminar', cor: '#b91c1c',
      intro: `Documentos expirados ou a expirar nos próximos ${JANELA_VALIDADE} dias. Expirado em vigor é documento sem valor na inspecção.`,
      colunas: ['Documento', 'Validade', 'Acção'],
      linhas: p.validade.slice(0, MAX_LINHAS).map(({ d, faltam }) => [
        ligaDoc(d),
        faltam < 0 ? `<span style="color:#b91c1c">${dataPt(ctx.expiraEm(d))}<br>expirou há ${plural(-faltam, 'dia', 'dias')}</span>` : `${dataPt(ctx.expiraEm(d))}<br><span style="font-size:12px;color:#64748b">faltam ${plural(faltam, 'dia', 'dias')}</span>`,
        faltam < 0 ? 'substituir ou retirar de vigor' : 'preparar a revisão nova',
      ]),
      mais: Math.max(p.validade.length - MAX_LINHAS, 0),
    })

    + seccao({
      titulo: 'Documentos sem par de revisão', cor: '#1d4ed8',
      intro: 'O documento está em vigor mas as revisões não respondem por hoje: a pergunta «que revisão estava em vigor no dia X?» fica sem resposta.',
      colunas: ['Documento', 'O que falta', 'Acção'],
      linhas: p.semPar.slice(0, MAX_LINHAS).map(({ d, motivo }) => [
        ligaDoc(d), esc(motivo), 'registar a revisão em vigor no portal',
      ]),
      mais: Math.max(p.semPar.length - MAX_LINHAS, 0),
    })

    + seccao({
      titulo: 'Ficheiros repetidos à espera de decisão', cor: '#475569',
      intro: 'Pares com o ficheiro byte a byte igual. Podem ser legítimos (a mesma norma em dois sítios): decida e o par sai da lista.',
      colunas: ['Documento', 'Par repetido', 'Acção'],
      linhas: p.repetidos.slice(0, MAX_LINHAS).map(x => [
        ligaDoc({ id: x.documento_id, titulo: x.titulo, numero: x.numero }),
        ligaDoc({ id: x.par_id, titulo: x.par_titulo, numero: x.par_numero }),
        'confirmar se ambos são legítimos',
      ]),
      mais: Math.max(p.repetidos.length - MAX_LINHAS, 0),
    });

  const html = layout({
    nomePortal: ctx.cfg.nome_portal, rodape: ctx.cfg.rodape_email,
    titulo: `${aero.codigo_icao} · ${aero.nome}`,
    intro: `${esc(resp.nome)}, há ${plural(p.total, 'pendência', 'pendências')} nos documentos do seu aeroporto (${p.docsDoAero.length} documentos no portal).`,
    corpo, url: `${PORTAL_URL}?aeroporto=${aero.id}`, botao: 'Abrir os documentos do aeroporto',
  });
  return { assunto, html };
}

export async function correrResumo(ctx) {
  const pronto = await registoPronto();
  if (!pronto && !DRY) {
    log('tabela documento_aviso_enviado em falta (migração 165 por aplicar) — NADA enviado, para não repetir avisos');
    return { enviados: 0, bloqueado: true };
  }
  if (!pronto) log('AVISO: migração 165 ainda não aplicada — em envio real este guião não enviaria nada');

  const r = { enviados: 0, repetidos: 0, naoEntregaveis: 0, erros: 0, semNada: 0, semResponsavel: [] };
  const aeroportos = ctx.aeroportos.filter(a => a.ativo !== false).filter(a => !ICAO || a.codigo_icao === ICAO);

  for (const aero of aeroportos) {
    const p = pendencias(ctx, aero);
    if (!p.total) {
      r.semNada++;
      log(`${aero.codigo_icao}: nada em falta (${p.docsDoAero.length} documentos) — não envia`);
      continue;
    }
    log(`${aero.codigo_icao}: total=${p.total} emendas=${p.emendas.length} (atraso=${p.emAtraso}) leituras=${p.leituras.length} validade=${p.validade.length} sem_par=${p.semPar.length} repetidos=${p.repetidos.length}`);
    const resps = ctx.responsaveis.filter(x => x.aeroporto_id === aero.id);
    if (!resps.length) {
      r.semResponsavel.push(aero.codigo_icao);
      log(`${aero.codigo_icao}: SEM RESPONSÁVEL — ${p.total} pendências sem para quem ir. Nomear o director no portal.`);
      continue;
    }
    for (const resp of resps) {
      const pessoa = { email: String(resp.email).toLowerCase(), nome: resp.nome || ctx.nomeDe(resp.email) };
      const { assunto, html } = montar(ctx, aero, pessoa, p);
      const estado = await avisar({
        tipo: 'resumo_aeroporto', chave: `resumo_aeroporto:${aero.id}:${pessoa.email}:${HOJE_ISO}`,
        para: pessoa.email, assunto, html, aeroporto_id: aero.id,
        detalhe: { total: p.total, emendas: p.emendas.length, em_atraso: p.emAtraso, leituras: p.leituras.length, validade: p.validade.length, sem_par: p.semPar.length, repetidos: p.repetidos.length },
      });
      if (estado === 'repetido') { r.repetidos++; log(`${aero.codigo_icao} -> ${pessoa.email}: já enviado hoje`); continue; }
      if (estado === 'fora_do_so') continue;
      if (estado === 'dry') { console.log(`[docs-resumo] (DRY) resumo_aeroporto -> ${pessoa.email} ${entregavel(pessoa.email) ? '' : '(NÃO entregável) '}:: ${assunto}`); r.enviados++; continue; }
      if (estado === 'nao_entregavel') { r.naoEntregaveis++; log(`não entregável (externo): ${pessoa.email}`); continue; }
      if (estado === 'erro') { r.erros++; log(`ERRO a enviar para ${pessoa.email}`); continue; }
      r.enviados++;
    }
  }
  log(`fim — ${DRY ? 'a enviar' : 'enviados'}=${r.enviados} repetidos=${r.repetidos} aeroportos_sem_nada=${r.semNada} não_entregáveis=${r.naoEntregaveis} erros=${r.erros}${r.semResponsavel.length ? ` SEM RESPONSÁVEL: ${r.semResponsavel.join(', ')}` : ''}`);
  return r;
}

// corrida directa: node scripts/relatorios/documentos-resumo-aeroporto.mjs --dry
if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  const ctx = await carregarContexto();
  if (SO) log(`só para ${SO}`);
  if (EXEMPLO) ctx.emendas = [...ctx.emendas, ...emendasDeExemplo(ctx)];
  await correrResumo(ctx);
}
