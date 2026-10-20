#!/usr/bin/env node
// Gera os conteúdos H5P (pt-PT) do curso "Como usar o Portal de Documentos (GED)" reutilizando as bibliotecas dos
// exemplos do h5p.org já extraídos em storage/uploads/h5p/demo-*/ (só troca h5p.json + content/content.json).
// Molde: tools/curso-uc/build-h5p.mjs.
//   node tools/curso-ged/build-h5p.mjs [--storage C:\dirops\sga-onpremise\storage\uploads\h5p]
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const STORAGE = args.includes('--storage') ? args[args.indexOf('--storage') + 1] : 'C:\\dirops\\sga-onpremise\\storage\\uploads\\h5p';
const uid = () => randomUUID();
const texto = (html) => ({ library: 'H5P.AdvancedText 1.1', params: { text: html }, subContentId: uid(), metadata: { contentType: 'Text', license: 'U', title: 'Texto' } });

const CONTEUDOS = [
  // 1) GLOSSÁRIO — cartões que se viram (sem pontuação, só para fixar)
  {
    origem: 'demo-dialog-cards-620', destino: 'ged-glossario', titulo: 'Glossário do Portal de Documentos (cartões)',
    content: {
      title: '<p>As palavras do GED</p>', description: '<p>Vire cada cartão para ver o significado. Não há pontuação — é só para fixar o vocabulário.</p>',
      mode: 'normal',
      dialogs: [
        ['Em vigor', 'A versão de um documento que vale AGORA. É a que deve usar. Os outros estados não servem para trabalhar.'],
        ['Revisão (versão)', 'Cada vez que um documento muda de forma significativa, nasce uma revisão nova. A anterior passa a obsoleta.'],
        ['Obsoleto', 'Uma versão que foi substituída por uma revisão mais recente. Fica na história, mas não se usa.'],
        ['Emenda', 'Uma alteração a um documento já em vigor (troca de páginas). Tem de ser confirmada em 30 dias por quem a recebe.'],
        ['Corrigenda', 'Corrige só gralhas, sem mudar o que o manual manda fazer. Nasce já aprovada, não precisa da ANAC.'],
        ['Confirmação de leitura', 'Quando um documento pede, carregar em "Li e tomei conhecimento" é a sua prova de que o recebeu e leu.'],
        ['Cópia controlada', 'Nos documentos de segurança (AVSEC), cada cópia é numerada e registada, e só vai para quem está credenciado.'],
        ['Credenciado', 'Pessoa autorizada a deter documentos classificados (AVSEC), com uma validade.'],
        ['Lista de Páginas Efectivas', 'A lista, por documento, de cada página com a sua revisão e data — prova que a cópia está completa e actual.'],
        ['Pasta', 'A estrutura que organiza os documentos, por aeroporto e por manual. Quem não vê a pasta não vê o que está lá dentro.'],
        ['Classe e processo', 'Partes do número: a classe diz o que o documento é (POP, MA, FR…); o processo diz de que manual faz parte (MOA, PSA…).'],
        ['Link partilhável', 'Um endereço temporário e de leitura, para dar um documento a alguém de fora (ANAC, auditor) sem conta no portal.'],
      ].map(([f, v]) => ({ text: `<p style="text-align:center;"><strong>${f}</strong></p>`, answer: `<p style="text-align:center;">${v}</p>`, tips: {} })),
      behaviour: { enableRetry: true, disableBackwardsNavigation: false, scaleTextNotCard: false, randomCards: false, maxProficiency: 5, quickProgression: false },
      answer: 'Virar', next: 'Seguinte', prev: 'Anterior', retry: 'Repetir', correctAnswer: 'Já sabia', incorrectAnswer: 'Ainda não sabia', round: 'Ronda @round', cardsLeft: 'Cartões restantes: @number', nextRound: 'Próxima ronda', startOver: 'Recomeçar', showSummary: 'Ver resumo', summary: 'Resumo', summaryCardsRight: 'Cartões que sabia:', summaryCardsWrong: 'Cartões por rever:', summaryCardsNotShown: 'Cartões não vistos:', summaryOverallScore: 'Pontuação:', summaryCardsCompleted: 'Cartões completados:', summaryCompletedRounds: 'Rondas completadas:', summaryAllDone: 'Muito bem! Viu todos os cartões @cards vezes @max.', progressText: 'Cartão @card de @total', cardFrontLabel: 'Frente do cartão', cardBackLabel: 'Verso do cartão', tipButtonLabel: 'Mostrar dica', audioNotSupported: 'O seu browser não suporta este áudio',
      confirmStartingOver: { header: 'Recomeçar?', body: 'Todo o progresso será perdido. Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Recomeçar' },
    },
  },

  // 2) VERIFICAÇÃO — escolha múltipla sobre encontrar e ler (consulta)
  {
    origem: 'demo-multiple-choice-713', destino: 'ged-quiz-encontrar', titulo: 'Verifique: encontrar e ler',
    content: {
      question: '<p>Quais destas afirmações são <strong>verdadeiras</strong>? (pode haver mais do que uma)</p>',
      answers: [
        { correct: true, text: '<div>Devo usar sempre a versão "Em vigor" do portal, não a cópia que tenho no computador.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo — uma cópia antiga envelhece sem avisar.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: true, text: '<div>A pesquisa encontra palavras dentro do texto dos documentos e diz em que página estão.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo — e leva-o directamente a essa página.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: false, text: '<div>Para abrir um documento tenho de pedir autorização de cada vez.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Não: se tem acesso à pasta, abre o documento directamente.', notChosenFeedback: '' } },
        { correct: true, text: '<div>Posso guardar um documento para ler sem internet, e o leitor avisa se houver revisão nova.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo — a cópia offline nunca engana em silêncio.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: false, text: '<div>O botão "Partilhar com externo" deixa a pessoa de fora alterar o documento.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Não: o link é só de leitura. A pessoa vê, não mexe.', notChosenFeedback: '' } },
      ],
      overallFeedback: [{ from: 0, to: 59, feedback: 'Reveja as aulas do módulo "Encontrar e ler".' }, { from: 60, to: 99, feedback: 'Quase — veja o feedback de cada opção.' }, { from: 100, to: 100, feedback: 'Perfeito!' }],
      behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, type: 'auto', singlePoint: false, randomAnswers: true, showSolutionsRequiresInput: true, confirmCheckDialog: false, confirmRetryDialog: false, autoCheck: false, passPercentage: 100, showScorePoints: true },
      UI: { checkAnswerButton: 'Verificar', submitAnswerButton: 'Submeter', showSolutionButton: 'Ver solução', tryAgainButton: 'Tentar de novo', tipsLabel: 'Ver dica', scoreBarLabel: 'Obteve :num de :total pontos', tipAvailable: 'Dica disponível', feedbackAvailable: 'Feedback disponível', readFeedback: 'Ler feedback', wrongAnswer: 'Resposta errada', correctAnswer: 'Resposta certa', shouldCheck: 'Devia ter sido marcada', shouldNotCheck: 'Não devia ter sido marcada', noInput: 'Responda antes de ver a solução', a11yCheck: 'Verificar as respostas.', a11yShowSolution: 'Mostrar a solução.', a11yRetry: 'Repetir a actividade.' },
      confirmCheck: { header: 'Terminar?', body: 'Tem a certeza de que quer terminar?', cancelLabel: 'Cancelar', confirmLabel: 'Terminar' }, confirmRetry: { header: 'Repetir?', body: 'Tem a certeza de que quer repetir?', cancelLabel: 'Cancelar', confirmLabel: 'Confirmar' },
    },
  },

  // 3) LACUNAS — completar frases-chave
  {
    origem: 'demo-fill-in-the-blanks-837', destino: 'ged-lacunas', titulo: 'Complete: as regras que evitam enganos',
    content: {
      text: '<p>Complete as frases com a palavra ou o número certo (sem distinguir maiúsculas).</p>',
      questions: [
        '<p>A versão de um documento que se deve usar é a que está *em vigor*.</p>',
        '<p>Ao receber uma emenda, tem *30/trinta* dias para confirmar que a recebeu.</p>',
        '<p>Confirmar a leitura é a sua *prova* de que recebeu e leu o documento.</p>',
        '<p>Um link partilhado com um auditor é temporário e de *leitura* — a pessoa vê, não altera.</p>',
        '<p>Para confirmar que leu, carrega no botão "Li e tomei *conhecimento*".</p>',
      ],
      behaviour: { enableSolutionsButton: true, autoCheck: false, caseSensitive: false, showSolutionsRequiresInput: true, separateLines: false, enableRetry: true, confirmCheckDialog: false, confirmRetryDialog: false, acceptSpellingErrors: true, enableCheckButton: true },
      showSolutions: 'Ver soluções', tryAgain: 'Tentar de novo', checkAnswer: 'Verificar', submitAnswer: 'Submeter', notFilledOut: 'Preencha todas as lacunas', answerIsCorrect: "':ans' está certo", answerIsWrong: "':ans' está errado", answeredCorrectly: 'Respondeu correctamente', answeredIncorrectly: 'Respondeu incorrectamente', solutionLabel: 'Resposta certa:', inputLabel: 'Lacuna @num de @total', inputHasTipLabel: 'Dica disponível', tipLabel: 'Dica', scoreBarLabel: 'Obteve :num de :total pontos',
      overallFeedback: [{ from: 0, to: 100 }],
      confirmCheck: { header: 'Terminar?', body: 'Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Terminar' }, confirmRetry: { header: 'Repetir?', body: 'Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Confirmar' },
      a11yCheck: 'Verificar as respostas.', a11yShowSolution: 'Mostrar a solução.', a11yRetry: 'Repetir.',
    },
  },

  // 4) ARRASTAR — quem faz o quê no percurso de aprovação
  {
    origem: 'demo-drag-and-drop-712', destino: 'ged-arrastar-fluxo', titulo: 'Quem faz o quê no percurso de aprovação?',
    content: (() => {
      const zonas = ['Elaborador', 'Revisor', 'Director'];
      const itens = [
        ['Carrega o PDF e o ficheiro editável', 0], ['Corrige o documento quando é devolvido', 0],
        ['Analisa e assina a revisão, ou devolve com motivo', 1], ['É o segundo a assinar o documento', 1],
        ['Aprova e assina — e só então o documento entra em vigor', 2], ['É o último a assinar no percurso', 2],
      ];
      return {
        scoreShow: 'Ver pontuação', tryAgain: 'Tentar de novo', submit: 'Submeter', scoreExplanation: 'Cada item na categoria certa vale 1 ponto; na errada desconta 1 (mínimo 0).',
        localize: { fullscreen: 'Ecrã inteiro', exitFullscreen: 'Sair do ecrã inteiro' },
        question: {
          settings: { size: { width: 800, height: 520 } },
          task: {
            elements: itens.map(([t], i) => ({ type: texto(`<p>${t}</p>`), x: i % 2 === 0 ? 3 : 52, y: 58 + Math.floor(i / 2) * 10, width: 44, height: 1.4, dropZones: ['0', '1', '2'], backgroundOpacity: 100, multiple: false })),
            dropZones: zonas.map((z, k) => ({ x: 3 + k * 33, y: 5, width: 28, height: 9.5, correctElements: itens.map(([, c], i) => (c === k ? String(i) : null)).filter(Boolean), showLabel: true, backgroundOpacity: 25, label: `<div>${z}</div>`, single: false, autoAlign: true, tipsAndFeedback: { tip: '', feedbackOnCorrect: '', feedbackOnIncorrect: '' } })),
          },
        },
        overallFeedback: [{ from: 0, to: 59, feedback: 'Reveja a aula "O percurso de aprovação, do início ao fim".' }, { from: 60, to: 99, feedback: 'Quase!' }, { from: 100, to: 100, feedback: 'Tudo no sítio certo.' }],
        behaviour: { enableRetry: true, singlePoint: false, enableScoreExplanation: true, applyPenalties: true, dropZoneHighlighting: 'dragging', autoAlignSpacing: 2, enableFullScreen: false, showScorePoints: true, enableCheckButton: true, showTitle: true },
        a11yCheck: 'Verificar.', a11yRetry: 'Repetir.',
      };
    })(),
  },

  // 5) PERGUNTAS FREQUENTES — acordeão
  {
    origem: 'demo-accordion-6-7138', destino: 'ged-faq', titulo: 'Perguntas frequentes do Portal de Documentos',
    content: {
      hTag: 'h2',
      panels: [
        ['Esqueci-me da senha. E agora?', '<p>Na página de entrada, carregue em "Esqueci a senha". Recebe no email as instruções para criar uma nova. Se não conseguir, use os emails de apoio no fundo da página.</p>'],
        ['Tenho uma cópia impressa. Posso usá-la?', '<p>Só para ler no momento. Antes de agir, confirme no portal que é a versão "Em vigor" — uma impressão envelhece sem avisar.</p>'],
        ['Como sei em que página o manual fala de um assunto?', '<p>Use a Pesquisa e escreva a palavra ou expressão. O portal mostra as páginas onde aparece, em todos os documentos a que tem acesso, e leva-o directamente a cada uma.</p>'],
        ['Pediram-me para confirmar a leitura. Como faço?', '<p>Abra o documento, leia-o, e carregue no botão azul "Li e tomei conhecimento", no topo. Fica a verde "Leitura confirmada em…" — é a sua prova.</p>'],
        ['Recebi uma emenda mas vou estar ausente. Perco o prazo?', '<p>Tem 30 dias, por isso há folga. Assim que puder, confirme — e se prevê uma ausência longa, avise o gestor de documentos do seu aeroporto.</p>'],
        ['Sou director mas só tenho perfil de leitor. Consigo assinar?', '<p>Sim. As Aprovações aparecem a quem tem de assinar, mesmo que só consulte no resto do portal. O que espera a sua assinatura aparece lá.</p>'],
        ['O link que envio para a ANAC deixa alterar os documentos?', '<p>Não. O link é temporário e de leitura: a pessoa vê o documento, não lhe mexe nem navega no resto. Um documento retirado deixa de sair por ele.</p>'],
        ['Não vejo a parte de "Gestão". Está em falta?', '<p>Não — o menu adapta-se ao seu perfil. Se é leitor, não vê a Gestão, e isso é de propósito.</p>'],
      ].map(([titulo, html]) => ({ title: titulo, content: texto(html) })),
    },
  },
];

let feitos = 0;
for (const c of CONTEUDOS) {
  const de = path.join(STORAGE, c.origem), para = path.join(STORAGE, c.destino);
  if (!fs.existsSync(path.join(de, 'h5p.json'))) { console.error('origem em falta: ' + de); continue; }
  fs.rmSync(para, { recursive: true, force: true });
  fs.cpSync(de, para, { recursive: true });
  for (const sub of ['images', 'audios', 'videos']) fs.rmSync(path.join(para, 'content', sub), { recursive: true, force: true });
  const h5p = JSON.parse(fs.readFileSync(path.join(para, 'h5p.json'), 'utf8'));
  Object.assign(h5p, { title: c.titulo, language: 'pt', defaultLanguage: 'pt', license: 'CC BY-SA', authors: [{ name: 'Direcção de Operações — SGA', role: 'Author' }] });
  fs.writeFileSync(path.join(para, 'h5p.json'), JSON.stringify(h5p));
  fs.writeFileSync(path.join(para, 'content', 'content.json'), JSON.stringify(c.content));
  feitos++;
  console.log(`${c.destino}  ←  ${c.origem}  (${h5p.mainLibrary})`);
}
console.log(`${feitos} conteúdos H5P em ${STORAGE}`);
