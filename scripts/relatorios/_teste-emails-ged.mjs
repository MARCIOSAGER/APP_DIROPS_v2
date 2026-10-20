#!/usr/bin/env node
// Envia UMA amostra de cada tipo de email do Portal de Documentos para um só endereço de teste, para o dono ver o
// aspecto. Usa os MESMOS construtores da produção (layout, secção, tabela, acção), por isso as amostras são fiéis.
//
// SEGURANÇA: o destinatário é FIXO (oaeroportos@sga.co.ao) e está escrito aqui — este guião NUNCA toca na lógica dos
// destinatários reais, nem lê a lista de directores. Envia um a um (nunca BCC), com pausa, porque o relay da SGA
// trata rajadas como spam. Cada assunto leva o prefixo [TESTE] para não se confundir com um aviso verdadeiro.
//
//   node scripts/relatorios/_teste-emails-ged.mjs          -> envia a sério para oaeroportos@sga.co.ao
//   node scripts/relatorios/_teste-emails-ged.mjs --dry    -> só lista o que enviaria, sem enviar
import { layout, seccao, tabela, acao, esc, FUNCTIONS, SERVICE, PORTAL_URL } from './_documentos-comum.mjs';

const DESTINO = 'oaeroportos@sga.co.ao';   // FIXO, de propósito. Não mudar para um director real.
const DRY = process.argv.includes('--dry');
const PAUSA = 1800;
// Marca de hora no prefixo: o backend recusa reenviar o mesmo (destinatário+assunto) dentro de 15 min (anti-duplicado).
// Num teste queremos mesmo receber de novo, por isso cada leva leva uma hora diferente no assunto, e passa.
const MARCA = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
const PREFIXO = `[TESTE ${MARCA}] `;
const log = (m) => console.log('[teste-emails] ' + m);

// Dados fictícios, claramente de exemplo, para as amostras não parecerem reais.
const DOC = 'POP-FNMO-MGSO-010 — Procedimento de Gestão de Risco de Segurança Operacional';
const AERO = 'FNMO';

// Destinos REAIS dos botões, iguais aos dos geradores de produção, para o dono poder clicar e aterrar no sítio
// certo. O id do documento vem de um documento verdadeiro em vigor (lido da base), para `/documento/:id` abrir algo.
// Passa-se por argumento: node _teste-emails-ged.mjs --doc=<uuid> --aero=<uuid>. Sem eles, o botão vai à entrada.
const arg = (n) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };
const DOC_ID = arg('doc');
const AERO_ID = arg('aero');
const urlDoc = DOC_ID ? `${PORTAL_URL}/documento/${DOC_ID}` : PORTAL_URL;
const urlAero = AERO_ID ? `${PORTAL_URL}?aeroporto=${AERO_ID}` : PORTAL_URL;
const urlAprov = `${PORTAL_URL}/aprovacao`;   // a caixa de entrada das Aprovações (sem fluxo real, aterra aqui)

// ── as amostras: uma por tipo de email ──────────────────────────────────────
const AMOSTRAS = [
  // ---- Confirmações e avisos (ciclo do documento) ----
  { nome: 'Documento novo',
    assunto: `Documentos SGA: documento novo em vigor — ${DOC.split(' — ')[0]}`,
    html: layout({
      titulo: 'Há um documento novo em vigor no seu aeroporto',
      intro: `Entrou em vigor um documento nas pastas a que tem acesso no <strong>${AERO}</strong>.`,
      corpo: tabela(['Documento', 'Revisão', 'Em vigor desde'], [[esc(DOC), 'Rev. 00', '03/10/2026']]),
      botao: 'Abrir o documento', url: urlDoc,
    }) },

  { nome: 'Leitura por confirmar',
    assunto: `Documentos SGA: precisa de confirmar a leitura de ${DOC.split(' — ')[0]}`,
    html: layout({
      titulo: 'Precisa de confirmar que leu um documento',
      intro: `O documento abaixo exige que confirme a sua leitura. A confirmação é a prova de que o recebeu.`,
      corpo: acao('Abra o documento no portal, leia-o e carregue em <strong>Confirmar leitura</strong>.') +
        tabela(['Documento', 'Revisão'], [[esc(DOC), 'Rev. 00']]),
      botao: 'Confirmar a leitura', url: urlDoc,
    }) },

  { nome: 'Emenda — lembrete (dentro do prazo)',
    assunto: `Documentos SGA: confirme a emenda 2026-004 de «${DOC.split(' — ')[0]}» até 12/10/2026`,
    html: layout({
      titulo: 'Falta a sua confirmação da emenda 2026-004',
      intro: `Recebeu uma emenda ao documento abaixo. Tem <strong>30 dias</strong> para confirmar que a inseriu.`,
      corpo: acao('Confirme até <strong>12/10/2026</strong> (faltam 9 dias). Abra o documento, verifique as páginas afectadas e confirme.') +
        tabela(['Documento', 'Emenda', 'Páginas afectadas', 'Prazo'], [[esc(DOC), '2026-004', '14, 15, 22', '12/10/2026']]),
      botao: 'Ver a emenda', url: urlDoc,
    }) },

  { nome: 'Emenda — prazo terminado',
    assunto: `Documentos SGA: prazo terminado — confirme hoje a emenda 2026-003 de «${DOC.split(' — ')[0]}»`,
    html: layout({
      titulo: 'O prazo terminou há 2 dias',
      intro: `A sua confirmação da emenda abaixo está em atraso. Confirme hoje, por favor.`,
      corpo: acao('Esta confirmação em falta é visível ao director do seu aeroporto. Abra o documento e confirme agora.') +
        tabela(['Documento', 'Emenda', 'Prazo era'], [[esc(DOC), '2026-003', '01/10/2026']]),
      botao: 'Confirmar agora', url: urlDoc,
    }) },

  { nome: 'Escalonamento ao director',
    assunto: `${AERO}: 3 confirmações da emenda 2026-003 em atraso — acção necessária`,
    html: layout({
      titulo: '3 confirmações em atraso no FNMO',
      intro: `As pessoas abaixo ainda não confirmaram a emenda <strong>2026-003</strong> e o prazo já passou.`,
      corpo: seccao({
        titulo: 'Quem não confirmou', cor: '#b91c1c',
        colunas: ['Pessoa', 'Cargo', 'Aviso enviado'],
        linhas: [
          ['amiguel6@sga.co.ao', 'Técnico de operações', 'sim'],
          ['dfernandes2@sga.co.ao', 'Supervisor', 'sim'],
          ['externo@gmail.com', '—', '<span style="color:#b91c1c">não — endereço externo, avise por outra via</span>'],
        ],
      }),
      botao: 'Ver no portal', url: urlDoc,
    }) },

  { nome: 'Resumo do aeroporto (director)',
    assunto: `${AERO}: 5 pendências nos documentos do seu aeroporto`,
    html: layout({
      titulo: 'Resumo dos documentos do FNMO',
      intro: `O estado dos documentos do seu aeroporto, para acompanhar de uma vista de olhos.`,
      corpo:
        seccao({ titulo: 'Confirmações de emenda', cor: '#b45309', colunas: ['Emenda', 'Em falta', 'Prazo'], linhas: [['2026-003', '3 pessoas', '<span style="color:#b91c1c">terminou</span>'], ['2026-004', '1 pessoa', '12/10/2026']] }) +
        seccao({ titulo: 'Leituras por confirmar', cor: '#b45309', colunas: ['Documento', 'Em falta'], linhas: [[esc(DOC), '1 pessoa']] }) +
        seccao({ titulo: 'Validade', cor: '#0f766e', colunas: ['Documento', 'Estado'], linhas: [['PL-FNMO-PEA-001 — Plano de Emergência', 'expira em 54 dias']] }),
      botao: 'Abrir o painel', url: urlAero,
    }) },

  // ---- Fluxo de aprovação ----
  { nome: 'Fluxo — espera a sua assinatura (revisor)',
    assunto: `Documentos SGA: ${DOC.split(' — ')[0]} espera a sua revisão`,
    html: layout({
      titulo: 'Um documento espera a sua assinatura',
      intro: `Foi-lhe atribuída a <strong>revisão</strong> do documento abaixo. Analise-o e assine, ou devolva com um motivo.`,
      corpo: acao('Abra o separador <strong>Aprovações</strong>, veja o documento e a versão, e assine com a sua senha — ou devolva ao elaborador.') +
        tabela(['Documento', 'Revisão', 'Elaborado por', 'A aguardar'], [[esc(DOC), 'Rev. 01', 'pgoncalves@sga.co.ao', 'a sua revisão']]),
      botao: 'Ir às Aprovações', url: urlAprov,
    }) },

  { nome: 'Fluxo — espera a sua assinatura (director)',
    assunto: `Documentos SGA: ${DOC.split(' — ')[0]} espera a sua aprovação`,
    html: layout({
      titulo: 'Um documento espera a sua aprovação',
      intro: `O documento abaixo foi revisto e assinado pelo revisor. Falta a sua aprovação como director para entrar em vigor.`,
      corpo: acao('Abra as <strong>Aprovações</strong>, confirme que está conforme e assine com a sua senha. A sua assinatura fica registada.') +
        tabela(['Documento', 'Revisão', 'Revisto por', 'A aguardar'], [[esc(DOC), 'Rev. 01', 'jpiedade@sga.co.ao', 'a sua aprovação']]),
      botao: 'Ir às Aprovações', url: urlAprov,
    }) },

  { nome: 'Fluxo — documento devolvido',
    assunto: `Documentos SGA: a revisão de ${DOC.split(' — ')[0]} foi-lhe devolvida`,
    html: layout({
      titulo: 'A sua revisão foi devolvida',
      intro: `O revisor devolveu o documento abaixo para correcção, antes de avançar.`,
      corpo: acao('<strong>Motivo da devolução:</strong> «Falta actualizar a referência ao RTA-2015 na secção 3; a tabela da página 14 está desalinhada.»') +
        tabela(['Documento', 'Revisão', 'Devolvido por'], [[esc(DOC), 'Rev. 01', 'jpiedade@sga.co.ao']]),
      botao: 'Corrigir e reenviar', url: urlDoc,
    }) },

  { nome: 'Fluxo — entrou em vigor',
    assunto: `Documentos SGA: ${DOC.split(' — ')[0]} entrou em vigor`,
    html: layout({
      titulo: 'O documento entrou em vigor',
      intro: `O percurso de aprovação terminou. A revisão abaixo está agora <strong>em vigor</strong> e a anterior passou a obsoleta.`,
      corpo: tabela(['Documento', 'Revisão', 'Em vigor desde', 'Aprovado por'], [[esc(DOC), 'Rev. 01', '03/10/2026', 'Director do FNMO']]),
      botao: 'Abrir o documento', url: urlDoc,
    }) },
];

(async () => {
  log(`${AMOSTRAS.length} amostras ${DRY ? 'que enviaria' : 'a enviar'} para ${DESTINO}`);
  if (!/@sga\.co\.ao$/i.test(DESTINO)) { log('ERRO: destino não é @sga.co.ao — o relay não entregaria. A abortar.'); process.exit(1); }
  let ok = 0, falhou = 0;
  for (let i = 0; i < AMOSTRAS.length; i++) {
    const a = AMOSTRAS[i];
    const assunto = PREFIXO + a.assunto;
    if (DRY) { log(`(${i + 1}/${AMOSTRAS.length}) ${a.nome} :: ${assunto}`); ok++; continue; }
    try {
      const r = await fetch(`${FUNCTIONS}/functions/send-email`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: DESTINO, subject: assunto, html: a.html, from_name: 'Portal de Documentos SGA' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
      log(`(${i + 1}/${AMOSTRAS.length}) enviado: ${a.nome}`);
      ok++;
      if (i < AMOSTRAS.length - 1) await new Promise(res => setTimeout(res, PAUSA));
    } catch (e) { log(`(${i + 1}/${AMOSTRAS.length}) FALHOU ${a.nome}: ${e.message}`); falhou++; }
  }
  log(`fim — ${ok} ${DRY ? 'listadas' : 'enviadas'}, ${falhou} falharam. Destino: ${DESTINO}`);
})().catch(e => { log('ERRO fatal: ' + e.message); process.exit(1); });
