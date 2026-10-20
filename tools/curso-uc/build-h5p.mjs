#!/usr/bin/env node
// Gera os conteúdos H5P (pt-PT) do curso "Como usar a Universidade Corporativa" reutilizando as bibliotecas dos
// exemplos do h5p.org já extraídos em storage/uploads/h5p/demo-*/ (só muda h5p.json + content/content.json).
//   node tools/curso-uc/build-h5p.mjs [--storage C:\dirops\sga-onpremise\storage\uploads\h5p]
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const STORAGE = args.includes('--storage') ? args[args.indexOf('--storage') + 1] : 'C:\\dirops\\sga-onpremise\\storage\\uploads\\h5p';
const uid = () => randomUUID();
const texto = (html) => ({ library: 'H5P.AdvancedText 1.1', params: { text: html }, subContentId: uid(), metadata: { contentType: 'Text', license: 'U', title: 'Texto' } });

const CONTEUDOS = [
  {
    origem: 'demo-dialog-cards-620', destino: 'uc-glossario', titulo: 'Glossário da Universidade Corporativa (cartões)',
    content: {
      title: '<p>Os termos que vai ouvir</p>', description: '<p>Vire cada cartão para ver o significado. Não há pontuação — é só para fixar o vocabulário.</p>',
      mode: 'normal',
      dialogs: [
        ['Catálogo', 'A lista de todos os cursos publicados. É por aqui que se começa: escolher e inscrever-se.'],
        ['Inscrição (matrícula)', 'O registo que lhe dá acesso às aulas de um curso. Feita por si no catálogo ou pelo gestor/instrutor.'],
        ['Módulo', 'Um capítulo do curso: agrupa aulas sobre o mesmo tema. Aparece como tema no verso do certificado.'],
        ['Aula', 'A unidade mais pequena: um vídeo, uma leitura, um PDF, uma actividade interactiva, uma ligação ou uma sessão presencial.'],
        ['Trilha', 'Uma sequência de cursos recomendada para uma função (ex.: Oficial de Pista).'],
        ['Formação obrigatória', 'Curso exigido para o seu perfil (ou para todos). Tem prazo para concluir e aparece na matriz de conformidade.'],
        ['Avaliação', 'O quiz final do curso, corrigido no servidor. Tem tentativas, tempo limite e nota mínima definidos pelo instrutor.'],
        ['Certificado', 'Documento emitido automaticamente quando aprova, com número único e validação pública. Pode ter validade.'],
        ['Validade e recertificação', 'Alguns cursos expiram (ex.: 12 meses). Antes do fim recebe avisos e pode recertificar: o curso reabre num novo ciclo.'],
        ['Refrescamento', 'Curso curto que renova a validade de um curso base sem o repetir por inteiro.'],
        ['Sessão presencial / online', 'Formação em sala, no terreno ou por videochamada (Teams/Meet). A presença marcada pelo formador conclui a aula.'],
        ['Pacote SCORM / H5P', 'Conteúdos interactivos que correm dentro da aula e comunicam com a plataforma: concluem a aula sozinhos e registam a nota.'],
        ['Modo foco', 'Durante uma aula ou avaliação os menus da aplicação desaparecem para se concentrar. "Mostrar menus" volta a mostrá-los.'],
        ['Modo sem consulta', 'Avaliação em ecrã inteiro em que saídas da janela, cópias e ferramentas do browser ficam registadas para o instrutor.'],
        ['Ficha do aluno', 'Na Gestão de Formação: o histórico completo de um colaborador — cursos, aulas, tempo, avaliações, certificados e sessões.'],
        ['Matriz de formação', 'Tabela colaboradores × cursos obrigatórios com o estado de cada um (válido, em curso, em falta, expirado).'],
      ].map(([f, v]) => ({ text: `<p style="text-align:center;"><strong>${f}</strong></p>`, answer: `<p style="text-align:center;">${v}</p>`, tips: {} })),
      behaviour: { enableRetry: true, disableBackwardsNavigation: false, scaleTextNotCard: false, randomCards: false, maxProficiency: 5, quickProgression: false },
      answer: 'Virar', next: 'Seguinte', prev: 'Anterior', retry: 'Repetir', correctAnswer: 'Já sabia', incorrectAnswer: 'Ainda não sabia', round: 'Ronda @round', cardsLeft: 'Cartões restantes: @number', nextRound: 'Próxima ronda', startOver: 'Recomeçar', showSummary: 'Ver resumo', summary: 'Resumo', summaryCardsRight: 'Cartões que sabia:', summaryCardsWrong: 'Cartões por rever:', summaryCardsNotShown: 'Cartões não vistos:', summaryOverallScore: 'Pontuação:', summaryCardsCompleted: 'Cartões completados:', summaryCompletedRounds: 'Rondas completadas:', summaryAllDone: 'Muito bem! Viu todos os cartões @cards vezes @max.', progressText: 'Cartão @card de @total', cardFrontLabel: 'Frente do cartão', cardBackLabel: 'Verso do cartão', tipButtonLabel: 'Mostrar dica', audioNotSupported: 'O seu browser não suporta este áudio',
      confirmStartingOver: { header: 'Recomeçar?', body: 'Todo o progresso será perdido. Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Recomeçar' },
    },
  },
  {
    origem: 'demo-multiple-choice-713', destino: 'uc-quiz-inscricao', titulo: 'Verifique: catálogo e inscrição',
    content: {
      question: '<p>Quais destas afirmações sobre o catálogo e a inscrição são <strong>verdadeiras</strong>? (pode haver mais do que uma)</p>',
      answers: [
        { correct: true, text: '<div>O distintivo "Obrigatório" só aparece nos cursos exigidos para o meu perfil.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo — e o prazo conta a partir da inscrição.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: true, text: '<div>Depois de me inscrever, o botão do curso passa a "Continuar".</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: false, text: '<div>Preciso de pedir ao instrutor para autorizar cada inscrição.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Não: a inscrição é imediata. O gestor pode também inscrevê-lo, mas não é preciso pedir.', notChosenFeedback: '' } },
        { correct: true, text: '<div>A carga horária do cartão é a soma das aulas, arredondada para cima.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Certo.', notChosenFeedback: 'Esta era verdadeira.' } },
        { correct: false, text: '<div>"Recertificar" apaga o meu certificado anterior.</div>', tipsAndFeedback: { tip: '', chosenFeedback: 'Não: o certificado anterior fica no histórico; é emitido um novo ao aprovar.', notChosenFeedback: '' } },
      ],
      overallFeedback: [{ from: 0, to: 59, feedback: 'Reveja a aula "Ler um cartão do catálogo".' }, { from: 60, to: 99, feedback: 'Quase — veja o feedback de cada opção.' }, { from: 100, to: 100, feedback: 'Perfeito!' }],
      behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, type: 'auto', singlePoint: false, randomAnswers: true, showSolutionsRequiresInput: true, confirmCheckDialog: false, confirmRetryDialog: false, autoCheck: false, passPercentage: 100, showScorePoints: true },
      UI: { checkAnswerButton: 'Verificar', submitAnswerButton: 'Submeter', showSolutionButton: 'Ver solução', tryAgainButton: 'Tentar de novo', tipsLabel: 'Ver dica', scoreBarLabel: 'Obteve :num de :total pontos', tipAvailable: 'Dica disponível', feedbackAvailable: 'Feedback disponível', readFeedback: 'Ler feedback', wrongAnswer: 'Resposta errada', correctAnswer: 'Resposta certa', shouldCheck: 'Devia ter sido marcada', shouldNotCheck: 'Não devia ter sido marcada', noInput: 'Responda antes de ver a solução', a11yCheck: 'Verificar as respostas.', a11yShowSolution: 'Mostrar a solução.', a11yRetry: 'Repetir a actividade.' },
      confirmCheck: { header: 'Terminar?', body: 'Tem a certeza de que quer terminar?', cancelLabel: 'Cancelar', confirmLabel: 'Terminar' }, confirmRetry: { header: 'Repetir?', body: 'Tem a certeza de que quer repetir?', cancelLabel: 'Cancelar', confirmLabel: 'Confirmar' },
    },
  },
  {
    origem: 'demo-fill-in-the-blanks-837', destino: 'uc-lacunas-aulas', titulo: 'Complete: os tipos de aula',
    content: {
      text: '<p>Complete as frases com a palavra certa (sem distinguir maiúsculas).</p>',
      questions: [
        '<p>Nas leituras longas, o modo *Livro/livro* mostra o texto em páginas que se viram; o modo *Contínuo/contínuo/continuo* mostra tudo seguido.</p>',
        '<p>No leitor de vídeo, a tecla *F/f* activa o ecrã inteiro e a tecla *C/c* liga ou desliga as legendas.</p>',
        '<p>Uma aula do tipo pacote *SCORM/scorm* ou *H5P/h5p* conclui-se sozinha quando termina a actividade.</p>',
        '<p>Os ficheiros anexados a uma aula aparecem em "Materiais para *download*".</p>',
        '<p>Para fechar a aula manualmente carrega no botão "Concluir e *avançar*".</p>',
      ],
      behaviour: { enableSolutionsButton: true, autoCheck: false, caseSensitive: false, showSolutionsRequiresInput: true, separateLines: false, enableRetry: true, confirmCheckDialog: false, confirmRetryDialog: false, acceptSpellingErrors: true, enableCheckButton: true },
      showSolutions: 'Ver soluções', tryAgain: 'Tentar de novo', checkAnswer: 'Verificar', submitAnswer: 'Submeter', notFilledOut: 'Preencha todas as lacunas', answerIsCorrect: "':ans' está certo", answerIsWrong: "':ans' está errado", answeredCorrectly: 'Respondeu correctamente', answeredIncorrectly: 'Respondeu incorrectamente', solutionLabel: 'Resposta certa:', inputLabel: 'Lacuna @num de @total', inputHasTipLabel: 'Dica disponível', tipLabel: 'Dica', scoreBarLabel: 'Obteve :num de :total pontos',
      overallFeedback: [{ from: 0, to: 100 }],
      confirmCheck: { header: 'Terminar?', body: 'Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Terminar' }, confirmRetry: { header: 'Repetir?', body: 'Tem a certeza?', cancelLabel: 'Cancelar', confirmLabel: 'Confirmar' },
      a11yCheck: 'Verificar as respostas.', a11yShowSolution: 'Mostrar a solução.', a11yRetry: 'Repetir.',
    },
  },
  {
    origem: 'demo-drag-and-drop-712', destino: 'uc-arrastar-separadores', titulo: 'Onde se faz o quê? (separadores do curso na Gestão de Formação)',
    content: (() => {
      const zonas = ['Avaliação', 'Sessões', 'Alunos'];
      const itens = [['Construir o quiz a partir do banco', 0], ['Corrigir uma resposta aberta', 0], ['Agendar uma sessão online (Teams)', 1], ['Marcar presenças e imprimir a folha', 1], ['Inscrever colaboradores em massa', 2], ['Enviar um lembrete por email', 2], ['Ver resultados e integridade das tentativas', 0], ['Enviar a convocatória com convite .ics', 1]];
      return {
        scoreShow: 'Ver pontuação', tryAgain: 'Tentar de novo', submit: 'Submeter', scoreExplanation: 'Cada item na categoria certa vale 1 ponto; na errada desconta 1 (mínimo 0).',
        localize: { fullscreen: 'Ecrã inteiro', exitFullscreen: 'Sair do ecrã inteiro' },
        question: {
          settings: { size: { width: 800, height: 520 } },
          task: {
            elements: itens.map(([t], i) => ({ type: texto(`<p>${t}</p>`), x: i % 2 === 0 ? 3 : 52, y: 58 + Math.floor(i / 2) * 10, width: 21, height: 1.4, dropZones: ['0', '1', '2'], backgroundOpacity: 100, multiple: false })),
            dropZones: zonas.map((z, k) => ({ x: 3 + k * 33, y: 5, width: 14, height: 9.5, correctElements: itens.map(([, c], i) => (c === k ? String(i) : null)).filter(Boolean), showLabel: true, backgroundOpacity: 25, label: `<div>${z}</div>`, single: false, autoAlign: true, tipsAndFeedback: { tip: '', feedbackOnCorrect: '', feedbackOnIncorrect: '' } })),
          },
        },
        overallFeedback: [{ from: 0, to: 59, feedback: 'Reveja a aula "A Gestão de Formação: separadores".' }, { from: 60, to: 99, feedback: 'Quase!' }, { from: 100, to: 100, feedback: 'Tudo no sítio certo.' }],
        behaviour: { enableRetry: true, singlePoint: false, enableScoreExplanation: true, applyPenalties: true, dropZoneHighlighting: 'dragging', autoAlignSpacing: 2, enableFullScreen: false, showScorePoints: true, enableCheckButton: true, showTitle: true },
        a11yCheck: 'Verificar.', a11yRetry: 'Repetir.',
      };
    })(),
  },
  {
    origem: 'demo-accordion-6-7138', destino: 'uc-faq-instrutor', titulo: 'Perguntas frequentes de quem cria cursos',
    content: {
      hTag: 'h2',
      panels: [
        ['Preciso de ser programador para criar um curso?', '<p>Não. O editor de conteúdo é visual: escreve o texto com blocos (notas, acordeões, passos), carrega vídeos e PDFs, e o quiz constrói-se a partir do banco de perguntas. Para conteúdos interactivos pode usar o eXeLearning ou o Lumi (H5P), ou pedir um curso no padrão "curso-html5".</p>'],
        ['O PowerPoint serve como aula?', '<p>Sim: carregue o .pptx numa aula do tipo PDF — é convertido no servidor. Os vídeos embutidos nos slides não passam para o PDF; carregue-os como aulas de vídeo à parte.</p>'],
        ['Como é calculada a carga horária?', '<p>Automaticamente: soma dos minutos de todas as aulas, arredondada para cima à hora. Aparece no catálogo e no certificado. Por isso, indique a duração real em cada aula.</p>'],
        ['O que acontece quando publico?', '<p>O curso passa a aparecer no catálogo. Se for obrigatório para perfis, esses colaboradores passam a "em falta" na matriz e recebem um email. Guarde uma versão antes de publicar alterações grandes.</p>'],
        ['Posso alterar um curso com alunos inscritos?', '<p>Pode. Cada inscrição fica ligada à versão em vigor na altura; alterações a aulas existentes aplicam-se a todos. Se apagar uma aula, o progresso dessa aula perde-se — prefira despublicar ou substituir o conteúdo.</p>'],
        ['Como impeço a batota na avaliação?', '<p>Active o modo sem consulta (ecrã inteiro, saídas registadas, cópia e DevTools bloqueados), baralhe perguntas e opções, use sorteio a partir do banco e limite o tempo. A correcção é feita no servidor; as respostas certas nunca chegam ao browser.</p>'],
        ['Quem assina o certificado?', '<p>Os signatários definidos em Assinantes (globais ou por curso). O certificado tem editor visual: textos, caixas livres, arte SGA e numeração automática com validação pública.</p>'],
        ['Como acompanho quem ainda não fez a formação obrigatória?', '<p>Visão geral (conformidade por perfil e aeroporto), Matriz (colaborador a colaborador) e o separador Alunos com "Inscrever em falta" e lembretes por email. O relatório semanal e os avisos diários saem automaticamente.</p>'],
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
