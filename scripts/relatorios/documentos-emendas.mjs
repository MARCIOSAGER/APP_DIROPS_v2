#!/usr/bin/env node
// ============================================================
// Portal de Documentos — prazo de confirmação das EMENDAS, do lembrete ao escalonamento.
//
// A LEI: o Instrutivo 22C.107.001.A (Apêndice 1, §1.5) dá ao detentor de uma cópia **30 dias** para confirmar,
// por assinatura, que inseriu a emenda que recebeu. O prazo está na própria emenda (documento_emenda.prazo_
// confirmacao, migração 150) e conta-se da data de distribuição. Até agora ninguém era avisado de que o prazo
// tinha passado: uma confirmação em falta é um achado de inspecção, e um achado de inspecção não se descobre no
// dia da inspecção.
//
// TRÊS AVISOS, nesta ordem:
//   1. LEMBRETE ao detentor — a 7 dias do prazo e na véspera (o mais próximo que ainda não saiu);
//   2. FIM DO PRAZO ao detentor — no dia em que o prazo termina, ou no primeiro dia em que se der por isso;
//   3. ESCALONAMENTO ao responsável do aeroporto — quando o prazo passou e a confirmação continua em falta.
//      Uma vez por emenda: a partir daí a falta vai no resumo diário do aeroporto (documentos-resumo-aeroporto),
//      que é o sítio onde deve ficar a arder enquanto não for resolvida, sem transformar o email num alarme.
//
// Um email por pessoa, sempre em To: o relay da SGA só entrega a @sga.co.ao e trata BCC/massa como spam.
// Anti-duplicado em documento_aviso_enviado (migração 165) — sem essa tabela, não envia nada.
//
// Flags: --dry (não envia nem grava)  --so=<email> (só esta pessoa)  --exemplo (só com --dry: ver abaixo)
// ============================================================
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DRY, EXEMPLO, SO, carregarContexto, registoPronto, avisar, entregavel, emendasDeExemplo,
  esc, dataPt, layout, acao, tabela, seccao, ligaDoc, plural, PORTAL_URL,
} from './_documentos-comum.mjs';

// Dias antes do prazo em que se lembra o detentor. Usa-se o limiar mais próximo que ainda não saiu, para que um
// agendador parado uma semana não despeje dois lembretes seguidos.
const LEMBRETES = [7, 1];

const log = (m) => console.log(`[docs-emendas]${DRY ? ' (DRY)' : ''} ${m}`);

function emailLembrete(ctx, e, pessoa) {
  const doc = { id: e.documento_id, titulo: e.documento_titulo, numero: e.documento_numero };
  const assunto = `${ctx.cfg.nome_portal}: confirme a emenda ${e.numero} de «${e.documento_titulo}» até ${dataPt(e.prazo_em)}`;
  const html = layout({
    nomePortal: ctx.cfg.nome_portal, rodape: ctx.cfg.rodape_email,
    titulo: `Falta a sua confirmação da emenda ${e.numero}`,
    intro: `${esc(pessoa.nome)}, o documento <strong>${esc(e.documento_titulo)}</strong> recebeu a emenda nº ${e.numero}, distribuída a ${dataPt(e.distribuida_em)}.`,
    corpo: acao(`<strong>O que tem de fazer:</strong> abra o documento no portal e confirme que inseriu a emenda na cópia que tem.<br>
      <strong>Até quando:</strong> ${dataPt(e.prazo_em)} — ${plural(e.dias_restantes, 'dia', 'dias')} a contar de hoje.`)
      + tabela(['Emenda', 'Documento', 'Páginas afectadas', 'Resumo'], [[
        `nº ${e.numero}${e.tipo === 'corrigenda' ? ' (corrigenda)' : ''}`,
        ligaDoc(doc),
        esc(e.paginas_afectadas || (e.modo === 'documento' ? 'revisão completa' : '—')),
        esc(e.resumo || '—'),
      ]])
      + `<p style="margin:14px 0 0;font-size:13px;color:#64748b">O prazo de ${e.prazo_dias} dias é o que o Instrutivo 22C.107.001.A (Apêndice 1, §1.5) fixa para o detentor confirmar a inserção da emenda.</p>`,
    url: `${PORTAL_URL}/documento/${e.documento_id}`, botao: 'Confirmar a emenda',
  });
  return { assunto, html };
}

function emailFimDoPrazo(ctx, e, pessoa) {
  const doc = { id: e.documento_id, titulo: e.documento_titulo, numero: e.documento_numero };
  const atraso = -e.dias_restantes;
  const assunto = `${ctx.cfg.nome_portal}: prazo terminado — confirme hoje a emenda ${e.numero} de «${e.documento_titulo}»`;
  const html = layout({
    nomePortal: ctx.cfg.nome_portal, rodape: ctx.cfg.rodape_email,
    titulo: atraso > 0 ? `O prazo terminou há ${plural(atraso, 'dia', 'dias')}` : 'O prazo termina hoje',
    intro: `${esc(pessoa.nome)}, a sua confirmação da emenda nº ${e.numero} de <strong>${esc(e.documento_titulo)}</strong> continua em falta. O prazo de ${e.prazo_dias} dias terminou ${atraso > 0 ? `a ${dataPt(e.prazo_em)}` : 'hoje'}.`,
    corpo: acao(`<strong>O que tem de fazer:</strong> confirme hoje no portal que inseriu a emenda. Se não tem a cópia consigo, diga-o ao director do aeroporto — ele já foi informado.<br>
      <strong>Porque é urgente:</strong> uma confirmação em falta é um achado de inspecção da ANAC, e a falta fica no seu nome no Registo de Emendas.`)
      + tabela(['Emenda', 'Documento', 'Distribuída', 'Prazo'], [[
        `nº ${e.numero}`, ligaDoc(doc), dataPt(e.distribuida_em),
        `<span style="color:#b91c1c">${dataPt(e.prazo_em)}</span>`,
      ]]),
    url: `${PORTAL_URL}/documento/${e.documento_id}`, botao: 'Confirmar agora',
  });
  return { assunto, html };
}

function emailEscalonamento(ctx, e, aeroporto, responsavel, faltam) {
  const doc = { id: e.documento_id, titulo: e.documento_titulo, numero: e.documento_numero };
  const atraso = Math.max(-e.dias_restantes, 0);
  const assunto = `${aeroporto?.codigo_icao || 'SGA'}: ${plural(faltam.length, 'confirmação', 'confirmações')} da emenda ${e.numero} em atraso — acção necessária`;
  const html = layout({
    nomePortal: ctx.cfg.nome_portal, rodape: ctx.cfg.rodape_email,
    titulo: `${plural(faltam.length, 'confirmação', 'confirmações')} em atraso no ${aeroporto?.codigo_icao || 'seu aeroporto'}`,
    intro: `${esc(responsavel.nome)}, o prazo de ${e.prazo_dias} dias para confirmar a emenda nº ${e.numero} de <strong>${esc(e.documento_titulo)}</strong> terminou a ${dataPt(e.prazo_em)}${atraso > 0 ? ` (há ${plural(atraso, 'dia', 'dias')})` : ''} e estas pessoas do seu aeroporto não confirmaram.`,
    corpo: acao(`<strong>O que tem de fazer:</strong> contactar cada pessoa da lista e garantir que confirma no portal; se a cópia já não está com ela, recolha-a e registe-o no portal.<br>
      <strong>Até quando:</strong> esta semana. A falta mantém-se no resumo diário do ${aeroporto?.codigo_icao || 'aeroporto'} até ser resolvida.<br>
      <strong>Porquê:</strong> o Instrutivo 22C.107.001.A (Apêndice 1, §1.5) exige a confirmação do detentor em ${e.prazo_dias} dias. Sem ela, não se prova que a cópia em uso está actual — é achado de inspecção.`)
      + seccao({
        titulo: 'Quem não confirmou', cor: '#b91c1c',
        intro: 'Detentores da cópia sem confirmação registada.',
        colunas: ['Pessoa', 'Email', 'Aviso enviado'],
        linhas: faltam.slice(0, 30).map(p => [esc(p.nome), esc(p.email), entregavel(p.email) ? 'sim' : '<span style="color:#b91c1c">não — endereço externo, avise por outra via</span>']),
        mais: Math.max(faltam.length - 30, 0),
      })
      + tabela(['Emenda', 'Documento', 'Distribuída', 'Prazo', 'Confirmações'], [[
        `nº ${e.numero}`, ligaDoc(doc), dataPt(e.distribuida_em),
        `<span style="color:#b91c1c">${dataPt(e.prazo_em)}</span>`, String(e.confirmacoes ?? 0),
      ]]),
    url: `${PORTAL_URL}/documento/${e.documento_id}`, botao: 'Ver o Registo de Emendas',
  });
  return { assunto, html };
}

export async function correrEmendas(ctx) {
  const pronto = await registoPronto();
  if (!pronto && !DRY) {
    log('tabela documento_aviso_enviado em falta (migração 165 por aplicar) — NADA enviado, para não repetir avisos');
    return { enviados: 0, bloqueado: true };
  }
  if (!pronto) log('AVISO: migração 165 ainda não aplicada — em envio real este guião não enviaria nada');

  const emendas = ctx.emendas;   // quem chama é que decide o que entra (ver --exemplo na entrada)
  log(`emendas distribuídas=${emendas.length}`);

  const r = { enviados: 0, repetidos: 0, naoEntregaveis: 0, erros: 0, lembretes: 0, prazos: 0, escalonamentos: 0, semResponsavel: [] };
  for (const e of emendas) {
    const doc = ctx.docs.find(d => d.id === e.documento_id);
    if (!doc) continue;
    const dets = ctx.detentores(doc);
    const faltam = dets.filter(p => !ctx.confirmado.has(`${e.emenda_id}|${p.email}`));
    const dr = e.dias_restantes;
    if (dr === null) { log(`emenda ${e.numero} de «${e.documento_titulo}» sem data de distribuição — ignorada`); continue; }
    log(`emenda nº ${e.numero} «${e.documento_titulo}» [${ctx.icao(e.aeroporto_id)}] prazo=${e.prazo_em} (${dr} dias) detentores=${dets.length} sem confirmar=${faltam.length}`);
    if (!faltam.length) continue;

    // 1) lembrete antes do prazo: o limiar mais próximo que ainda se aplica
    const limiar = dr > 0 ? LEMBRETES.filter(x => dr <= x).sort((a, b) => a - b)[0] : null;
    if (limiar) {
      for (const p of faltam) {
        const msg = emailLembrete(ctx, e, p);
        await despachar(r, { tipo: 'emenda_lembrete', chave: `emenda_lembrete:${e.emenda_id}:${limiar}:${p.email}`, para: p.email, ...msg, documento_id: doc.id, emenda_id: exemploNulo(e), prazo_em: e.prazo_em, detalhe: { emenda: e.numero, dias_restantes: dr, limiar } }) && r.lembretes++;
      }
    }

    // 2) fim do prazo, ao detentor
    if (dr <= 0) {
      for (const p of faltam) {
        const msg = emailFimDoPrazo(ctx, e, p);
        await despachar(r, { tipo: 'emenda_prazo', chave: `emenda_prazo:${e.emenda_id}:${p.email}`, para: p.email, ...msg, documento_id: doc.id, emenda_id: exemploNulo(e), prazo_em: e.prazo_em, detalhe: { emenda: e.numero, atraso_dias: -dr } }) && r.prazos++;
      }
    }

    // 3) escalonamento ao responsável do aeroporto, uma vez por emenda
    if (dr < 0) {
      const aero = ctx.aeroDe.get(e.aeroporto_id) || null;
      const resps = ctx.responsaveis.filter(x => x.aeroporto_id === e.aeroporto_id);
      if (!resps.length) {
        r.semResponsavel.push(`${ctx.icao(e.aeroporto_id)} (emenda ${e.numero} de «${e.documento_titulo}»)`);
        log(`SEM RESPONSÁVEL: ${ctx.icao(e.aeroporto_id)} — escalonamento da emenda ${e.numero} não tem para quem ir`);
      }
      for (const resp of resps) {
        const pessoa = { email: String(resp.email).toLowerCase(), nome: resp.nome || ctx.nomeDe(resp.email) };
        const msg = emailEscalonamento(ctx, e, aero, pessoa, faltam);
        await despachar(r, { tipo: 'emenda_escalonamento', chave: `emenda_escalonamento:${e.emenda_id}:${e.aeroporto_id}:${pessoa.email}`, para: pessoa.email, ...msg, documento_id: doc.id, emenda_id: exemploNulo(e), aeroporto_id: e.aeroporto_id, prazo_em: e.prazo_em, detalhe: { emenda: e.numero, em_falta: faltam.map(p => p.email) } }) && r.escalonamentos++;
      }
    }
  }
  log(`fim — ${DRY ? 'a enviar' : 'enviados'}=${r.enviados} repetidos=${r.repetidos} não_entregáveis=${r.naoEntregaveis} erros=${r.erros} (lembretes=${r.lembretes} fim_do_prazo=${r.prazos} escalonamentos=${r.escalonamentos})`);
  return r;
}

// As emendas de exemplo não existem na base: não podem ir para a chave estrangeira do registo.
const exemploNulo = (e) => (e.exemplo ? null : e.emenda_id);

// Devolve true quando o aviso saiu de facto (ou sairia, em --dry): é isso que os contadores por tipo contam.
async function despachar(r, aviso) {
  const estado = await avisar(aviso);
  if (estado === 'repetido') { r.repetidos++; return false; }
  if (estado === 'fora_do_so') return false;
  if (estado === 'dry') { console.log(`[docs-emendas] (DRY) ${aviso.tipo} -> ${aviso.para} ${entregavel(aviso.para) ? '' : '(NÃO entregável) '}:: ${aviso.assunto}`); r.enviados++; return true; }
  if (estado === 'nao_entregavel') { r.naoEntregaveis++; log(`não entregável (externo): ${aviso.para}`); return false; }
  if (estado === 'erro') { r.erros++; log(`ERRO a enviar para ${aviso.para}`); return false; }
  r.enviados++;
  return true;
}

// corrida directa: node scripts/relatorios/documentos-emendas.mjs --dry
if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  const ctx = await carregarContexto();
  if (SO) log(`só para ${SO}`);
  if (EXEMPLO) { ctx.emendas = [...ctx.emendas, ...emendasDeExemplo(ctx)]; log('--exemplo: duas emendas fictícias acrescentadas (nada é gravado nem enviado)'); }
  await correrEmendas(ctx);
}
