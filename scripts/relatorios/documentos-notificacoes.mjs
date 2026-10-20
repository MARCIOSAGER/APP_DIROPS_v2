#!/usr/bin/env node
// ============================================================
// Portal de Documentos — avisos por email. É esta a entrada que o despachante conhece (chave `documentos_avisos`
// em scripts/relatorios/dispatcher.mjs) e corre três partes, por esta ordem:
//
//   1) PESSOAL   — um email a cada pessoa, só com o que lhe diz respeito nos aeroportos a que tem acesso:
//                    • documentos novos em vigor desde o último aviso (janela de N dias);
//                    • leituras por confirmar («Li e tomei conhecimento») nos documentos que as exigem;
//                    • para gestores e responsáveis: documentos à espera de aprovação;
//                    • para gestores e responsáveis: validade a terminar nos próximos 30 dias.
//   2) EMENDAS   — prazo de confirmação do detentor (30 dias, Instrutivo 22C.107.001.A, Apêndice 1 §1.5):
//                  lembrete antes do prazo, aviso no fim do prazo e ESCALONAMENTO ao responsável do aeroporto
//                  quando o prazo passa sem confirmação.   → documentos-emendas.mjs
//   3) RESUMO    — um email por aeroporto, ao seu director, com o que está em falta no aeroporto dele.
//                                                           → documentos-resumo-aeroporto.mjs
//
// Quem não tiver nada para ver não recebe email nenhum.
//
// DUAS LEIS DO RELAY DA SGA: só entrega a @sga.co.ao e trata BCC/envio em massa como spam (550). Daí um email
// por pessoa, sempre com o destinatário em To, nunca em BCC, nunca uma lista.
//
// IDEMPOTENTE: cada aviso é registado em documento_aviso_enviado (migração 165) com uma chave única. O
// despachante passa de 15 em 15 minutos; sem isto o mesmo aviso saía quatro vezes por hora. Enquanto a migração
// 165 não estiver aplicada, nada é enviado — falhar sem enviar é o lado seguro.
//
// Flags: --dry (não envia nem grava; imprime quem receberia o quê)
//        --so=<email> / --to=<email> (limita a uma pessoa)   --dias=7 (janela dos documentos novos)
//        --parte=pessoal|emendas|resumo|todas (por omissão todas)
//        --icao=FNMO (só um aeroporto, na parte do resumo)
//        --exemplo (só com --dry: acrescenta duas emendas fictícias para mostrar o ciclo completo)
// ============================================================
import {
  DRY, EXEMPLO, SO, flags, HOJE_ISO, carregarContexto, registoPronto, avisar, entregavel, emendasDeExemplo,
  esc, dataPt, diasAte, layout, seccao, ligaDoc, plural, PORTAL_URL,
} from './_documentos-comum.mjs';
import { correrEmendas } from './documentos-emendas.mjs';
import { correrResumo } from './documentos-resumo-aeroporto.mjs';

const JANELA_DIAS = Number(flags.dias) > 0 ? Number(flags.dias) : 7;
const PARTE = String(flags.parte || 'todas').toLowerCase();
const fazer = (p) => PARTE === 'todas' || PARTE === p;
const log = (m) => console.log(`[docs-avisos]${DRY ? ' (DRY)' : ''} ${m}`);

// perfis do portal: o que cada pessoa pode ver (mesma escada que a RLS do servidor, migração 136b)
const nivel = (u) => {
  const p = Array.isArray(u.perfis) ? u.perfis : [];
  const admin = u.role === 'admin' || u.role === 'superadmin' || p.includes('administrador') || p.includes('admin_documentos');
  const gestor = admin || p.includes('gestor_documentos');
  const membro = gestor || p.includes('editor_documentos') || p.includes('leitor_documentos');
  return { admin, gestor, membro };
};

// ---------- parte 1: o aviso individual ----------
async function correrPessoal(ctx) {
  const pronto = await registoPronto();
  if (!pronto && !DRY) { log('tabela documento_aviso_enviado em falta (migração 165 por aplicar) — NADA enviado'); return { enviados: 0, bloqueado: true }; }
  if (!pronto) log('AVISO: migração 165 ainda não aplicada — em envio real esta parte não enviaria nada');

  const emVigor = ctx.docs.filter(d => (d.estado || 'em_vigor') === 'em_vigor');
  const novos = emVigor.filter(d => { const q = diasAte(d.em_vigor_desde || d.publicacao_em || d.updated_date); return q !== null && q <= 0 && q > -JANELA_DIAS; });
  const porAprovar = ctx.docs.filter(d => ['em_revisao', 'aprovado'].includes(d.estado || ''));
  const comValidade = emVigor.map(d => ({ d, faltam: diasAte(ctx.expiraEm(d)) })).filter(x => x.faltam !== null && x.faltam <= 30);
  const ehResponsavel = new Set(ctx.responsaveis.map(r => String(r.email).toLowerCase()));

  const r = { enviados: 0, repetidos: 0, semNada: 0, naoEntregaveis: 0, erros: 0 };
  for (const u of ctx.users.filter(x => x.status === 'ativo')) {
    const email = String(u.email || '').toLowerCase();
    if (!email || (SO && email !== SO)) continue;
    const n = nivel(u);
    if (!n.membro) { r.semNada++; continue; }
    // aeroportos desta pessoa (membro ou responsável), como a regra do servidor faz
    const meusAeroportos = new Set(ctx.aeroportos.filter(a => (ctx.porAeroporto.get(a.id) || new Set()).has(email)).map(a => a.id));
    const vejo = (d) => n.admin || meusAeroportos.has(ctx.aeroportoDoDoc(d));

    const pedeMe = (d) => !Array.isArray(d.leitura_perfis) || !d.leitura_perfis.length || d.leitura_perfis.some(p => (u.perfis || []).includes(p));
    const meusNovos = novos.filter(vejo).slice(0, 25);
    const porConfirmar = emVigor.filter(d => d.exige_leitura && vejo(d) && pedeMe(d) && !ctx.lido.has(`${d.id}|${email}`)).slice(0, 25);
    const aprovoEu = (n.gestor || ehResponsavel.has(email)) ? porAprovar.filter(vejo).slice(0, 25) : [];
    const expiram = (n.gestor || ehResponsavel.has(email)) ? comValidade.filter(x => vejo(x.d)).slice(0, 25) : [];

    const corpo = [
      seccao({ titulo: 'Documentos novos em vigor', cor: '#0f766e', intro: `Entraram em vigor nos últimos ${JANELA_DIAS} dias. Leia-os.`,
        colunas: ['Documento', 'Tipo', 'Aeroporto', 'Em vigor desde'],
        linhas: meusNovos.map(d => [ligaDoc(d), esc(ctx.tipoDe.get(d.tipo_id)?.nome || '—'), esc(ctx.icao(ctx.aeroportoDoDoc(d))), dataPt(d.em_vigor_desde || d.publicacao_em)]) }),
      seccao({ titulo: 'Leituras por confirmar', cor: '#b45309', intro: 'Abra o documento e confirme que o leu — é o que prova que tomou conhecimento.',
        colunas: ['Documento', 'Tipo', 'Aeroporto', 'Estado'],
        linhas: porConfirmar.map(d => [ligaDoc(d), esc(ctx.tipoDe.get(d.tipo_id)?.nome || '—'), esc(ctx.icao(ctx.aeroportoDoDoc(d))), '<span style="color:#b45309">por confirmar</span>']) }),
      seccao({ titulo: 'À espera da sua aprovação', cor: '#1d4ed8', intro: 'Documentos em revisão nos aeroportos por que responde.',
        colunas: ['Documento', 'Tipo', 'Aeroporto', 'Estado'],
        linhas: aprovoEu.map(d => [ligaDoc(d), esc(ctx.tipoDe.get(d.tipo_id)?.nome || '—'), esc(ctx.icao(ctx.aeroportoDoDoc(d))), esc(d.estado === 'aprovado' ? 'aprovado, falta publicar' : 'em revisão')]) }),
      seccao({ titulo: 'Validade a terminar', cor: '#b91c1c', intro: 'Documentos expirados ou a expirar nos próximos 30 dias.',
        colunas: ['Documento', 'Tipo', 'Aeroporto', 'Validade'],
        linhas: expiram.map(x => [ligaDoc(x.d), esc(ctx.tipoDe.get(x.d.tipo_id)?.nome || '—'), esc(ctx.icao(ctx.aeroportoDoDoc(x.d))),
          x.faltam < 0 ? `<span style="color:#b91c1c">expirou há ${plural(-x.faltam, 'dia', 'dias')}</span>` : `expira em ${plural(x.faltam, 'dia', 'dias')}`]) }),
    ].filter(Boolean);

    if (!corpo.length) { r.semNada++; continue; }
    const assunto = `${ctx.cfg.nome_portal}: ${meusNovos.length ? plural(meusNovos.length, 'documento novo', 'documentos novos')
      : porConfirmar.length ? plural(porConfirmar.length, 'leitura por confirmar', 'leituras por confirmar')
      : aprovoEu.length ? plural(aprovoEu.length, 'documento à sua espera', 'documentos à sua espera')
      : 'documentos com validade a terminar'}`;
    const html = layout({
      nomePortal: ctx.cfg.nome_portal, rodape: `${ctx.cfg.rodape_email} Recebe este aviso porque tem acesso a documentos dos aeroportos da SGA.`,
      titulo: 'O que precisa da sua atenção',
      intro: `Olá ${esc(u.full_name || email.split('@')[0])}, isto é o que está à sua espera no portal.`,
      corpo: corpo.join(''), url: PORTAL_URL,
    });

    const estado = await avisar({ tipo: 'pessoal', chave: `pessoal:${email}:${HOJE_ISO}`, para: email, assunto, html,
      detalhe: { novos: meusNovos.length, leituras: porConfirmar.length, aprovar: aprovoEu.length, validade: expiram.length } });
    if (estado === 'repetido') { r.repetidos++; continue; }
    if (estado === 'fora_do_so') continue;
    if (estado === 'dry') { console.log(`[docs-avisos] (DRY) pessoal -> ${email} ${entregavel(email) ? '' : '(NÃO entregável) '}:: ${assunto} [novos=${meusNovos.length} leituras=${porConfirmar.length} aprovar=${aprovoEu.length} validade=${expiram.length}]`); r.enviados++; continue; }
    if (estado === 'nao_entregavel') { r.naoEntregaveis++; log(`não entregável (externo): ${email}`); continue; }
    if (estado === 'erro') { r.erros++; log(`ERRO a enviar para ${email}`); continue; }
    r.enviados++;
  }
  log(`pessoal — ${DRY ? 'a enviar' : 'enviados'}=${r.enviados} já_hoje=${r.repetidos} sem_nada=${r.semNada} não_entregáveis=${r.naoEntregaveis} erros=${r.erros} (janela ${JANELA_DIAS} dias)`);
  return r;
}

// ---------- corrida ----------
const ctx = await carregarContexto();
if (SO) log(`só para ${SO}`);
if (EXEMPLO) { ctx.emendas = [...ctx.emendas, ...emendasDeExemplo(ctx)]; log('--exemplo: duas emendas fictícias acrescentadas (nada é gravado nem enviado)'); }
log(`portal=${ctx.cfg.nome_portal} documentos=${ctx.docs.length} aeroportos=${ctx.aeroportos.length} responsáveis=${ctx.responsaveis.length} emendas_distribuídas=${ctx.emendas.length}`);

let erros = 0;
if (fazer('pessoal')) erros += (await correrPessoal(ctx)).erros || 0;
if (fazer('emendas')) erros += (await correrEmendas(ctx)).erros || 0;
if (fazer('resumo')) erros += (await correrResumo(ctx)).erros || 0;
log(`fim de tudo — erros=${erros}`);
process.exit(erros ? 1 : 0);
