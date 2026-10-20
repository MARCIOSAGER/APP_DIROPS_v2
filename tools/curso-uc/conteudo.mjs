// Conteúdo do curso "Como usar a Universidade Corporativa — guia completo" (pt-PT).
// HTML das aulas usa os blocos do editor rico (.prose-aula): callout, acordeao, pergunta-inline, colunas, passos, figure, table.
const U = '/storage/v1/object/public/uploads';
const fig = (nome, legenda, alt) => `<figure><img src="${U}/uc/${nome}" alt="${alt || legenda}" /><figcaption>${legenda}</figcaption></figure>`;
const callout = (estilo, titulo, html) => `<div class="callout callout-${estilo}"><div class="callout-corpo"><p class="callout-titulo">${titulo}</p>${html}</div></div>`;
const acordeao = (itens) => itens.map(([t, h]) => `<details class="acordeao"><summary>${t}</summary>${h}</details>`).join('');
const pergunta = (p, r) => `<details class="pergunta-inline"><summary>${p}</summary><p><strong>Resposta:</strong> ${r}</p></details>`;
const passos = (itens) => `<ol class="passos">${itens.map(i => `<li>${i}</li>`).join('')}</ol>`;
const colunas = (cols) => `<div class="colunas">${cols.map(c => `<div>${c}</div>`).join('')}</div>`;
const tabela = (cab, linhas) => `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const CRED = 'Conteúdo produzido internamente pela Direcção de Operações — SGA para a Universidade Corporativa (Setembro 2026).';

export const CURSO = {
  titulo: 'Como usar a Universidade Corporativa — guia completo',
  descricao: `Tudo o que precisa para tirar partido da plataforma de formação da SGA, explicado do zero: como encontrar e ler o catálogo, inscrever-se, fazer aulas de todos os tipos (vídeo, leitura em modo livro, PDF, actividades interactivas SCORM e H5P, sessões presenciais e online), fazer a avaliação, obter e renovar o certificado, ganhar pontos e participar. A segunda metade é para quem cria e gere formação: montar um curso, produzir conteúdos, construir a avaliação, configurar o certificado, agendar sessões e acompanhar a conformidade.

Para quem: todos os colaboradores (módulos 1 a 4) e instrutores/gestores de formação (módulos 5 a 7).

Como funciona: 7 módulos com um vídeo de apresentação, leituras curtas, um guia em PDF, cinco actividades H5P, uma prática guiada interactiva e uma avaliação final que usa todos os tipos de pergunta da plataforma. Este curso é, ele próprio, uma demonstração de todas as ferramentas disponíveis.`,
  categoria: 'Universidade Corporativa', nivel: 'iniciante', publicado: true, ordem: 0, tipo_formacao: 'inicial',
  capa_url: `${U}/capas/uc-capa.svg`, validade_meses: null, prazo_dias: null, obrigatorio_todos: false, obrigatorio_perfis: [],
  creditos: CRED,
};

// ─────────────────────────────────────────────────────────────────────────────
const M1 = {
  titulo: 'Bem-vindo: o essencial em 10 minutos', descricao: 'O que é a plataforma, onde fica e o vocabulário básico.',
  aulas: [
    { titulo: 'Vídeo: a Universidade Corporativa em 70 segundos', tipo: 'video', duracao_min: 3, conteudo_url: `${U}/uc/universidade-corporativa-apresentacao.mp4`, legendas_url: `${U}/uc/universidade-corporativa-apresentacao.vtt`, poster_url: `${U}/uc/universidade-corporativa-apresentacao_poster.jpg`, creditos: CRED + ' Vídeo sem narração; ligue as legendas (CC) para ler o texto.', materiais: [{ nome: 'Guia rápido do aluno (PDF)', url: `${U}/uc/guia-rapido-aluno.pdf`, tamanho: 163305 }] },
    { titulo: 'O que é a Universidade Corporativa e o que vai encontrar', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>A <strong>Universidade Corporativa</strong> é a área de formação do DIROPS. Junta num só sítio os cursos da SGA, o seu progresso, as avaliações e os certificados — tudo ligado ao seu utilizador, sem papéis e sem depender de alguém para lhe dizer "onde é que isto está".</p>
${callout('info', 'Se nunca usou uma plataforma de formação', '<p>Pense nela como uma biblioteca com professor: escolhe um curso, faz as aulas pela ordem que quiser, responde a uma avaliação e recebe um certificado. O sistema lembra-se de tudo o que já fez.</p>')}
<h2>O que pode fazer aqui</h2>
${colunas([
  '<p><strong>Como aluno</strong></p><ul><li>Ver o catálogo e os cursos obrigatórios para a sua função.</li><li>Inscrever-se com um clique.</li><li>Fazer aulas de vídeo, leitura, PDF e actividades interactivas.</li><li>Inscrever-se em sessões presenciais ou online.</li><li>Fazer a avaliação e receber o certificado.</li><li>Ganhar pontos e distintivos, comentar e perguntar.</li></ul>',
  '<p><strong>Como instrutor ou gestor</strong></p><ul><li>Criar cursos e trilhas, com aulas de todos os tipos.</li><li>Construir avaliações com dez tipos de pergunta.</li><li>Desenhar o certificado e definir quem assina.</li><li>Agendar sessões, marcar presenças, convocar por email.</li><li>Inscrever pessoas, enviar lembretes, acompanhar a conformidade.</li><li>Ver a analítica de cada curso e exportar tudo para Excel e PDF.</li></ul>',
])}
<h2>Como está organizado um curso</h2>
${passos(['<strong>Curso</strong> — o todo: tem título, instrutor, duração, avaliação e certificado.', '<strong>Módulos</strong> — os capítulos. Aparecem numerados (01, 02…) e como temas no verso do certificado.', '<strong>Aulas</strong> — os passos dentro de cada módulo: um vídeo, uma leitura, um PDF, uma actividade, uma ligação ou uma sessão presencial.', '<strong>Avaliação</strong> — o quiz final, corrigido no servidor.', '<strong>Certificado</strong> — emitido ao aprovar, com validade quando o curso a exige.'])}
${fig('fig-fluxo-aluno.svg', 'O percurso de qualquer aluno: catálogo → inscrição → aulas → avaliação → certificado → recertificação quando a validade termina.')}
<h2>Regras simples que evitam surpresas</h2>
<ul>
  <li>O progresso guarda-se sozinho — pode fechar o browser a meio e retomar depois.</li>
  <li>As aulas concluem-se com o botão <strong>"Concluir e avançar"</strong>, excepto as actividades interactivas e as sessões presenciais, que se concluem sozinhas.</li>
  <li>A avaliação tem regras (tentativas, tempo, nota mínima) que lê antes de a iniciar.</li>
  <li>Tudo o que faz fica registado: aulas concluídas, tempo, tentativas, presenças. É isso que sustenta o certificado e a conformidade da empresa.</li>
</ul>
${pergunta('Se fechar o computador a meio de uma aula, perco o que já fiz?', 'Não. As aulas concluídas, a posição do vídeo e a página do livro ficam guardadas. Quando voltar, o curso abre onde parou.')}
` },
    { titulo: 'Como chegar: menu Formação, separadores e modo foco', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>A Universidade Corporativa vive dentro do DIROPS, no menu da esquerda, no grupo <strong>Formação</strong>.</p>
${fig('fig-menu.svg', 'O menu Formação e os quatro separadores da área do aluno.')}
${passos(['Entre no DIROPS com o seu utilizador habitual.', 'No menu da esquerda abra <strong>Formação</strong> e clique em <strong>Universidade Corporativa</strong>. (A entrada "Gestão de Formação" só aparece a instrutores e administradores.)', 'No topo da página escolha o separador que precisa.'])}
<h2>Os quatro separadores</h2>
${tabela(['Separador', 'Para que serve', 'Quando o usa'], [
  ['<strong>Catálogo</strong>', 'Todos os cursos publicados, com capa, duração e nível. Os obrigatórios para si estão assinalados.', 'Para começar um curso novo.'],
  ['<strong>Os meus cursos</strong>', 'O que já começou, o progresso de cada um, os seus pontos, distintivos e o ranking.', 'Para continuar onde ficou.'],
  ['<strong>Trilhas</strong>', 'Sequências de cursos recomendadas para uma função (ex.: Oficial de Pista).', 'Quando quer seguir um percurso completo.'],
  ['<strong>Certificados</strong>', 'Os certificados emitidos, a validade e o download em PDF.', 'Para provar a formação ou ver quando expira.'],
])}
<h2>Modo foco</h2>
<p>Quando abre uma aula ou uma avaliação, o menu lateral e o cabeçalho da aplicação <strong>desaparecem</strong>: fica só o conteúdo, o índice do curso e os botões de navegação. É de propósito — menos distracções.</p>
<ul><li>Para voltar a ver os menus sem sair da aula, clique em <strong>"Mostrar menus"</strong> no canto superior direito. A escolha fica guardada.</li><li>Para sair da aula, use <strong>"Voltar ao curso"</strong> no topo.</li></ul>
${callout('dica', 'No telemóvel', '<p>Tudo funciona no telemóvel: o índice do curso abre num painel ("Conteúdo do curso") e os vídeos passam a ecrã inteiro com um toque duplo.</p>')}
${pergunta('Não vejo "Gestão de Formação" no menu. É normal?', 'Sim, se não for instrutor nem administrador. Os alunos só precisam da Universidade Corporativa. Se vai criar cursos, peça a um administrador o perfil "instrutor".')}
` },
    { titulo: 'Glossário: os termos que vai ouvir (cartões H5P)', tipo: 'html5', duracao_min: 6, conteudo_url: `${U}/h5p/uc-glossario/`, conclusao: 'manual', opcoes: { norma: 'h5p', main_library: 'H5P.Dialogcards' }, creditos: 'Actividade H5P (Dialog Cards) produzida internamente com o leitor H5P da plataforma. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

const M2 = {
  titulo: 'O catálogo e a inscrição', descricao: 'Ler um cartão, inscrever-se, perceber prazos, obrigatoriedade e os emails que vai receber.',
  aulas: [
    { titulo: 'Ler um cartão do catálogo', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Cada curso aparece no catálogo como um cartão. Saber lê-lo evita inscrever-se no curso errado ou deixar passar um prazo.</p>
${fig('fig-catalogo.svg', 'Anatomia de um cartão: capa e categoria, nível, título e resumo, duração e estrutura, obrigatório e prazo, botão de acção.')}
${tabela(['Elemento', 'O que significa'], [
  ['<strong>Capa e categoria</strong>', 'A área a que o curso pertence (Operações, Safety, Segurança…). A cor e a imagem ajudam a reconhecer o tema.'],
  ['<strong>Nível</strong>', 'Iniciante (não precisa de saber nada), intermédio (já trabalha na área) ou avançado.'],
  ['<strong>Duração</strong>', 'Horas calculadas pela soma das aulas, arredondadas para cima. É o tempo de referência, não um limite.'],
  ['<strong>Módulos e aulas</strong>', 'Quantos capítulos e quantos passos tem. Clique no cartão para ver a lista completa.'],
  ['<strong>Obrigatório</strong>', 'Só aparece se o curso é exigido para o seu perfil (ou para todos). Nesse caso há normalmente um <strong>prazo</strong>, contado desde a inscrição.'],
  ['<strong>Refrescamento</strong>', 'Curso curto que renova a validade de um curso base. Só faz sentido depois de ter feito o curso base.'],
  ['<strong>Botão</strong>', '"Inscrever-se" (ainda não começou), "Continuar" (já inscrito), "Recertificar" (a validade está a terminar) ou "Concluído".'],
])}
<h2>Filtrar e procurar</h2>
<p>Use a caixa de pesquisa por título ou categoria. Os cursos obrigatórios em falta aparecem primeiro e com o distintivo laranja.</p>
${acordeao([
  ['O que é "formação obrigatória"?', '<p>Um curso que a empresa exige para determinadas funções (por exemplo, condução no lado ar para quem conduz na placa). Aparece assinalado, conta para a matriz de conformidade e gera avisos por email enquanto não for feito.</p>'],
  ['E se o prazo passar?', '<p>O curso fica "atrasado" na sua ficha e na matriz. Continua a poder fazê-lo; o seu supervisor e o gestor de formação vêem o atraso. Fale com eles se houver um motivo.</p>'],
  ['Posso inscrever-me em vários cursos ao mesmo tempo?', '<p>Sim. Cada um tem o seu progresso. Só a avaliação é que é feita curso a curso.</p>'],
])}
${pergunta('Um cartão diz "9 h · 24 aulas". Tenho de fazer as 9 horas de seguida?', 'Não. É a soma das durações das aulas. Faça ao seu ritmo; o sistema guarda onde ficou.')}
` },
    { titulo: 'A página do curso e a inscrição', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Ao clicar num cartão abre a página do curso: o programa completo, o instrutor, as sessões e a avaliação. É aqui que se inscreve.</p>
${fig('fig-curso.svg', 'A página do curso: cabeçalho e resumo, conteúdo por módulos (com cadeados até se inscrever), sessões, avaliação e o cartão lateral com "Inscrever-se".')}
${passos(['Leia o resumo: para quem é, o que vai saber fazer e como funciona.', 'Percorra o <strong>Conteúdo do curso</strong>: módulos e aulas com o tipo e a duração de cada uma. Os cadeados indicam que ainda não está inscrito.', 'Se o curso tem componente prática, veja as <strong>Sessões presenciais</strong> disponíveis.', 'Carregue em <strong>Inscrever-se</strong> no cartão da direita. O acesso é imediato: os cadeados desaparecem e o botão passa a "Continuar".', 'Clique na primeira aula — ou em "Continuar", que o leva sempre à próxima aula por fazer.'])}
${callout('atencao', 'Inscrição feita por outra pessoa', '<p>O gestor de formação pode inscrevê-lo directamente (por exemplo, nos cursos obrigatórios). Nesse caso recebe um email com a ligação para o curso e o prazo, e o curso aparece já em "Os meus cursos".</p>')}
<h2>O cartão lateral</h2>
<ul><li><strong>Instrutor</strong> — a quem pode perguntar (nos comentários de cada aula).</li><li><strong>Carga horária</strong> e <strong>nível</strong>.</li><li>Depois de inscrito: a sua percentagem de progresso, a próxima aula e, quando concluir, a ligação para o certificado.</li></ul>
${pergunta('Inscrevi-me por engano. Posso anular?', 'Fale com o gestor de formação: só ele pode remover uma inscrição. Se simplesmente não fizer o curso, ele fica "em curso" na sua lista sem consequências, a não ser que seja obrigatório.')}
` },
    { titulo: 'Formação obrigatória, prazos, validade e os emails que vai receber', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>A plataforma avisa-o por email dos momentos importantes. Saber o que cada email significa poupa dúvidas.</p>
${tabela(['Email', 'Quando chega', 'O que fazer'], [
  ['Foi inscrito no curso "…"', 'Quando um gestor ou uma trilha o inscreve.', 'Abrir o curso e começar; ver o prazo, se existir.'],
  ['Formação obrigatória em falta', 'Quando um curso obrigatório para o seu perfil ainda não tem inscrição (repete todos os meses).', 'Inscrever-se no catálogo.'],
  ['Lembrete: "…" por concluir', '7 e 21 dias depois da inscrição, se ainda não terminou.', 'Continuar o curso.'],
  ['A sua certificação expira em N dias', 'A 30 e a 7 dias do fim da validade.', 'Carregar em "Recertificar" na página do curso.'],
  ['Certificação expirada', 'No dia em que a validade termina.', 'Recertificar logo que possível.'],
  ['Certificado emitido', 'Quando aprova numa avaliação com certificado.', 'Descarregar em Certificados.'],
  ['Convocatória / lembrete de sessão', 'Quando é inscrito numa sessão e na véspera.', 'Aceitar o convite de calendário; ir ou entrar pela ligação.'],
])}
${callout('info', 'Só chegam a endereços @sga.co.ao', '<p>Os emails saem pelo servidor de correio da SGA. Se usa outro endereço, não os recebe — mas tudo continua visível na plataforma.</p>')}
<h2>Validade e recertificação</h2>
<p>Alguns cursos têm <strong>validade</strong> (por exemplo, 12 meses para a condução no lado ar). No fim da validade o certificado expira. Antes disso:</p>
${passos(['A 30 dias do fim recebe o primeiro aviso; o cartão do curso mostra "a expirar".', 'Carregue em <strong>Recertificar</strong>. Duas coisas podem acontecer: o curso reabre num novo ciclo (refaz as aulas e a avaliação) ou, se existir um <strong>curso de refrescamento</strong>, é esse que abre — mais curto, renova a validade do curso base.', 'Ao aprovar, é emitido um certificado novo com nova validade. O anterior fica no histórico.'])}
${pergunta('O meu certificado expirou há 2 meses. Perdi tudo?', 'Não. O histórico fica. Basta recertificar: o curso reabre e, ao aprovar, recebe um certificado novo. Enquanto não o fizer, a formação conta como expirada na matriz da empresa.')}
` },
    { titulo: 'Verifique: catálogo e inscrição (H5P)', tipo: 'html5', duracao_min: 4, conteudo_url: `${U}/h5p/uc-quiz-inscricao/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.MultiChoice' }, creditos: 'Actividade H5P (Multiple Choice) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

const M3 = {
  titulo: 'Aprender: aulas de todos os tipos', descricao: 'O leitor de aulas e cada tipo de conteúdo: vídeo, leitura em livro, PDF, interactivos, ligações e materiais.',
  aulas: [
    { titulo: 'O leitor de aulas: índice, progresso, concluir e navegar', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Todas as aulas abrem no mesmo leitor. Conhecer as quatro áreas chega para nunca se perder.</p>
${fig('fig-aula.svg', 'O leitor de aulas: A — conteúdo; B — barra de acções; C — comentários; D — índice com o progresso.')}
${tabela(['Área', 'O que tem'], [
  ['<strong>A · Conteúdo</strong>', 'O vídeo, a leitura, o PDF ou a actividade. Por baixo, os materiais para download e os créditos das fontes.'],
  ['<strong>B · Barra de acções</strong>', '"Anterior", "Concluir e avançar" (ou "Concluir aula" na última) e "Próxima". Depois de concluída, aparece "Aula concluída" e um botão para desmarcar.'],
  ['<strong>C · Comentários</strong>', 'Perguntas e comentários de quem está inscrito; as respostas do instrutor aparecem destacadas.'],
  ['<strong>D · Índice</strong>', 'Todos os módulos e aulas, com ✅ nas concluídas e a barra de progresso. Clique numa aula para saltar para ela.'],
])}
<h2>Concluir uma aula</h2>
<ul>
  <li>Nas aulas de vídeo, leitura, PDF e ligação, <strong>é você que conclui</strong> com "Concluir e avançar". Se o fizer por engano, "Desmarcar" volta atrás.</li>
  <li>Nas actividades interactivas (SCORM/H5P com pontuação) e nas sessões presenciais, a aula <strong>conclui-se sozinha</strong>: o botão não aparece e o leitor explica porquê.</li>
  <li>O progresso do curso é a percentagem de aulas concluídas. A 100 %, a avaliação (se existir) fica disponível.</li>
</ul>
${callout('dica', 'O índice também serve de mapa', '<p>Não precisa de fazer as aulas por ordem, mas a ordem foi pensada pelo instrutor. Se saltar, o índice mostra sempre o que falta.</p>')}
<h2>O tempo que passa na aula</h2>
<p>A plataforma mede o tempo em que a aula está visível no ecrã (em batidas de 30 segundos). Não é para o vigiar: serve para o instrutor perceber que aulas são demasiado longas ou curtas e para a sua ficha mostrar quanto estudou.</p>
${pergunta('Concluí uma aula sem a ler. Há problema?', 'Fica registado que a concluiu com pouco tempo — o instrutor vê isso na analítica. E, sobretudo, a avaliação final vai perguntar sobre essa matéria.')}
` },
    { titulo: 'Vídeo: controlos, velocidade, legendas e retomar', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Os vídeos correm dentro da plataforma — não há ligações para o YouTube nem anúncios. Os controlos são os mesmos para vídeos do YouTube e para vídeos carregados pela SGA.</p>
${colunas([
  '<p><strong>Controlos</strong></p><ul><li>Play/pausa (clique no vídeo ou barra de espaços).</li><li>Barra de tempo: arraste para saltar.</li><li>Volume e silenciar.</li><li><strong>Velocidade</strong>: 0,75×, 1×, 1,25×, 1,5×, 2×.</li><li><strong>CC</strong>: legendas em português (ligadas por omissão nos vídeos estrangeiros).</li><li>Ecrã inteiro (também com duplo clique).</li></ul>',
  '<p><strong>Teclas</strong></p>' + tabela(['Tecla', 'Acção'], [['Espaço / K', 'Reproduzir ou pausar'], ['← / →', 'Recuar / avançar 5 s'], ['J / L', 'Recuar / avançar 10 s'], ['F', 'Ecrã inteiro'], ['M', 'Silenciar'], ['C', 'Legendas'], ['0–9', 'Saltar para 0 %…90 %']]),
])}
<h2>Retomar onde ficou</h2>
<p>Se sair a meio, a posição fica guardada. Ao voltar, o vídeo continua no mesmo ponto (a partir dos 5 segundos). No fim do vídeo a posição volta ao início.</p>
${callout('info', 'Legendas em português de Portugal', '<p>Nos vídeos do YouTube as legendas automáticas vêm em português — o YouTube oferece a variante "Português (Portugal)" e o leitor pede-a por omissão. Nos vídeos carregados pela SGA, as legendas existem quando o instrutor anexou um ficheiro de legendas (.vtt) — como neste curso, no vídeo de apresentação.</p>')}
${pergunta('Posso ver o vídeo a 2× e concluir a aula?', 'Pode. A velocidade é sua. Mas lembre-se de que a avaliação cobre o conteúdo do vídeo.')}
` },
    { titulo: 'Leitura: texto em modo livro e PDF em livro', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
<p>Esta aula é, ela própria, um exemplo: é uma leitura longa e por isso abriu em <strong>modo Livro</strong>. Repare no interruptor "Livro / Contínuo" acima do texto.</p>
<h2>Modo Livro</h2>
${passos(['As páginas viram-se com os botões <strong>Anterior/Seguinte</strong>, com as setas do teclado, clicando nas margens ou deslizando no telemóvel.', 'Em ecrãs largos vê duas páginas lado a lado, como um livro aberto; em ecrãs pequenos, uma.', 'Os botões <strong>A−/A+</strong> mudam o tamanho da letra; a escolha fica guardada para todas as aulas.', 'O botão de <strong>ecrã inteiro</strong> esconde tudo o resto.', 'A barra dourada em baixo mostra a percentagem lida. A página em que ficou é lembrada.'])}
<h2>Modo Contínuo</h2>
<p>Mostra o texto todo seguido, com a barra de deslocamento do browser. É útil para procurar (Ctrl+F) ou copiar um trecho. Pode mudar de modo a qualquer momento; a plataforma lembra a sua preferência.</p>
<h2>PDF em modo livro</h2>
<p>Os PDFs (apresentações, manuais, instrutivos) abrem como um livro aberto: duas páginas lado a lado, virar com as setas ou clicando nas margens, <strong>miniaturas</strong> de todas as páginas, <strong>zoom</strong> até 200 % e ecrã inteiro. A página em que ficou também é lembrada. Por baixo há sempre "Abrir em nova aba" e "Descarregar" para quem prefere o visor do browser ou quer guardar o ficheiro.</p>
${callout('dica', 'Experimente já', '<p>A aula seguinte é um PDF — o guia rápido do aluno. Abra as miniaturas, faça zoom e volte aqui com "Anterior".</p>')}
<h2>Os blocos que pode encontrar numa leitura</h2>
<p>Os instrutores escrevem as leituras com blocos que ajudam a organizar a informação. Vai reconhecê-los pela forma:</p>
${callout('info', 'Nota informativa', '<p>Contexto ou explicação adicional. Azul.</p>')}
${callout('atencao', 'Atenção', '<p>Algo que pode correr mal se não for cumprido. Âmbar.</p>')}
${callout('perigo', 'Perigo', '<p>Regra de segurança que não admite excepções. Vermelho.</p>')}
${callout('dica', 'Dica / boa prática', '<p>Um atalho ou uma forma melhor de fazer. Verde.</p>')}
${acordeao([['Acordeão — clique para abrir', '<p>Guarda detalhes que nem todos precisam de ler. Abre e fecha ao clicar no título.</p>']])}
${pergunta('Pergunta com resposta escondida — o que é isto?', 'Uma forma de se testar enquanto lê: pense na resposta antes de a revelar.')}
${passos(['Passos numerados: procedimentos, pela ordem certa.', 'Cada passo é uma acção concreta.'])}
${colunas(['<p><strong>Colunas</strong></p><p>Comparações lado a lado…</p>', '<p><strong>…</strong></p><p>…ou dois pontos de vista.</p>'])}
${tabela(['Tabelas', 'Para dados'], [['Valores, limites', 'Critérios, referências']])}
<p>Por fim, as <strong>figuras com legenda</strong>, como as que viu nas aulas anteriores, e os <strong>materiais para download</strong> no fim da aula.</p>
` },
    { titulo: 'Guia rápido do aluno (PDF em modo livro)', tipo: 'pdf', duracao_min: 10, conteudo_url: `${U}/uc/guia-rapido-aluno.pdf`, creditos: CRED + ' Documento em PDF gerado a partir do guia interno; pode ser impresso.', materiais: [{ nome: 'Guia rápido do aluno (PDF)', url: `${U}/uc/guia-rapido-aluno.pdf`, tamanho: 163305 }] },
    { titulo: 'Conteúdos interactivos, ligações, materiais e comentários', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Além de vídeo e leitura, há três tipos de aula que se comportam de forma diferente. E, em qualquer aula, há materiais, créditos e comentários.</p>
${acordeao([
  ['Pacote interactivo (SCORM / xAPI)', '<p>Um "mini-curso" que corre dentro da aula: páginas com navegação própria, flashcards, arrastar e largar, quizzes de treino, barra de progresso e um ecrã final. Comunica com a plataforma: quando termina, <strong>a aula conclui-se sozinha</strong> e a nota fica registada. O botão "Abrir em ecrã inteiro" abre-o numa aba própria. Exemplo: a "Prática guiada" no módulo 4.</p>'],
  ['Conteúdo H5P', '<p>Actividades curtas — cartões, escolha múltipla, lacunas, arrastar, acordeões, vídeo interactivo. Correm no leitor interno. As que têm pontuação concluem a aula sozinhas ao terminar; as que não têm (cartões, acordeões) concluem-se com o botão. Exemplos: o glossário do módulo 1 e o teste do módulo 2.</p>'],
  ['Ligação', '<p>Abre um recurso noutra aba — por exemplo, o módulo Safety do DIROPS para praticar um reporte, ou uma página externa. Conclui com o botão.</p>'],
  ['Sessão presencial', '<p>Aula feita em sala, no terreno ou por videochamada. Mostra as sessões agendadas para se inscrever; a presença marcada pelo formador conclui a aula. Detalhes no módulo 4.</p>'],
])}
<h2>Materiais para download e créditos</h2>
<p>No fim de cada aula pode aparecer <strong>"Materiais para download"</strong>: apresentações, checklists, formulários, o próprio PDF. Clique em "Descarregar". Por baixo, os <strong>créditos</strong> indicam a fonte (ICAO, ANAC, canal do YouTube…) — a SGA usa conteúdos de terceiros sempre com a fonte identificada.</p>
<h2>Perguntas e comentários</h2>
${passos(['No fim da aula, escreva a sua pergunta ou comentário e carregue em <strong>Publicar</strong>.', 'Os colegas inscritos vêem-no e podem responder; o instrutor responde com o distintivo "Instrutor" e pode fixar a resposta no topo.', 'Pode apagar os seus próprios comentários. O instrutor pode moderar.'])}
${callout('dica', 'Vale pontos', '<p>Cada comentário dá 2 pontos (até 5 por dia) e cinco comentários dão o distintivo "Voz activa". Mas o objectivo é aprender: pergunte o que não percebeu.</p>')}
${pergunta('Terminei uma actividade H5P mas a aula não ficou concluída. Porquê?', 'Se a actividade não tem pontuação (cartões, acordeão), conclua com o botão. Se tem pontuação, veja se chegou ao fim e carregou em "Verificar"; a aula avisa quando recebe o resultado.')}
` },
    { titulo: 'Complete: os tipos de aula (H5P)', tipo: 'html5', duracao_min: 4, conteudo_url: `${U}/h5p/uc-lacunas-aulas/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.Blanks' }, creditos: 'Actividade H5P (Fill in the Blanks) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

const M4 = {
  titulo: 'Avaliar, certificar e continuar', descricao: 'A avaliação final, o certificado, as sessões, os pontos — e uma prática guiada interactiva.',
  aulas: [
    { titulo: 'A avaliação final: regras, tempo, tentativas e tipos de pergunta', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
<p>A avaliação é o quiz final do curso. É corrigida no servidor, no momento em que submete, e decide a conclusão do curso e o certificado.</p>
<h2>Antes de começar</h2>
${passos(['Na página do curso, abra o cartão <strong>Avaliação</strong>. Normalmente só fica disponível depois de concluir todas as aulas.', 'Leia as regras: <strong>tentativas</strong> (ex.: 2), <strong>tempo limite</strong> (ex.: 40 min), <strong>nota mínima</strong> (ex.: 70 %) e se é <strong>sem consulta</strong>.', 'Garanta ligação estável e tempo livre. Carregue em <strong>Iniciar avaliação</strong>.'])}
<h2>Durante</h2>
<ul><li>Uma pergunta de cada vez, com "Anterior/Seguinte"; a barra mostra quantas já respondeu.</li><li>As respostas <strong>gravam-se sozinhas</strong>. Se a ligação cair, retome — a tentativa continua onde estava.</li><li>O cronómetro está sempre visível; nos últimos 2 minutos fica vermelho. Quando chega a zero, a avaliação é submetida com o que tiver respondido.</li><li>No fim, "Submeter" pede confirmação se houver perguntas em branco.</li></ul>
<h2>Os dez tipos de pergunta</h2>
${tabela(['Tipo', 'Como responder'], [
  ['Escolha única', 'Uma opção certa.'], ['Escolha múltipla', 'Uma ou mais certas; pontuação parcial (certas menos erradas).'], ['Verdadeiro / Falso', 'Classificar a afirmação.'],
  ['Lacuna', 'Escrever a palavra ou número; não distingue maiúsculas nem acentos.'], ['Numérica', 'Um valor, com tolerância definida pelo instrutor.'], ['Ordenação', 'Colocar os itens pela ordem certa (setas ou arrastar); pontuação parcial por posição.'],
  ['Correspondência', 'Ligar cada termo à definição (menus); pontuação parcial por par.'], ['Ponto na imagem', 'Clicar no sítio certo de uma figura.'], ['Rótulos na imagem', 'Associar cada rótulo a uma zona numerada da figura.'],
  ['Resposta aberta', 'Texto livre, corrigido pelo instrutor — a nota fica "a aguardar correcção" até lá.'],
])}
${callout('perigo', 'Modo sem consulta', '<p>Quando a avaliação é "sem consulta", o ecrã passa a inteiro e a plataforma <strong>regista</strong> cada saída da janela, cada tentativa de copiar ou de abrir ferramentas do browser. Esses registos aparecem ao instrutor na correcção. As respostas certas nunca chegam ao seu computador — a correcção é feita no servidor — por isso não há "truques" que resultem, só registos que prejudicam.</p>')}
<h2>Depois</h2>
<p>Vê a nota, se aprovou, e a <strong>revisão</strong> pergunta a pergunta com a explicação (se o instrutor a activou). Se reprovou e ainda tem tentativas, "Nova tentativa" — as perguntas podem vir baralhadas ou sorteadas do banco. A nota que conta é a da tentativa aprovada.</p>
${pergunta('Fiquei "a aguardar correcção". Chumbei?', 'Não. Tem uma resposta aberta que o instrutor ainda não corrigiu. Se a sua nota já chega ao mínimo sem essa pergunta, está aprovado desde já; senão, o resultado sai quando o instrutor corrigir.')}
` },
    { titulo: 'Certificados: emissão, validade, download e validação', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Ao aprovar numa avaliação que emite certificado, o certificado é criado <strong>no mesmo instante</strong>, com número único, e recebe um email.</p>
${passos(['Vá ao separador <strong>Certificados</strong>. Cada cartão mostra o curso, a data, o número e a validade.', 'Carregue em <strong>Descarregar PDF</strong>. O certificado tem a arte da SGA, os signatários e, no verso, os temas do curso.', 'A página de <strong>validação pública</strong> (ligação e código no próprio certificado) permite a qualquer entidade confirmar que é autêntico.'])}
<h2>Validade</h2>
<ul><li>Se o curso tem validade, o certificado mostra "válido até" e o cartão muda de cor à medida que se aproxima do fim (a expirar, expirado).</li><li>Cursos ligados à <strong>licença de condução no lado ar</strong> actualizam automaticamente a licença no módulo Safety quando o certificado é emitido.</li><li>Ao recertificar, o certificado novo substitui o anterior na matriz da empresa; o antigo fica no histórico.</li></ul>
${callout('info', 'O instrutor também pode emitir', '<p>Em cursos sem avaliação, ou por decisão do instrutor, o certificado pode ser emitido manualmente na Gestão de Formação. Aparece-lhe da mesma forma.</p>')}
${pergunta('Preciso do certificado em papel?', 'Descarregue o PDF e imprima. A validação pública garante a autenticidade mesmo em papel: quem receber pode confirmar o número na página indicada.')}
` },
    { titulo: 'Sessões presenciais e online', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Alguns cursos têm uma parte prática em sala, no terreno ou por videochamada (Teams/Meet). Essa parte é uma <strong>aula do tipo sessão presencial</strong>, e a inscrição faz-se na página do curso ou dentro da própria aula.</p>
${passos(['Na secção <strong>Sessões presenciais</strong> veja as datas, o local ou a plataforma, o formador e os lugares.', 'Carregue em <strong>Inscrever-me</strong>. Numa sessão híbrida escolha "Na sala" ou "Online". Se a sala estiver cheia fica em <strong>lista de espera</strong> e é promovido se surgir uma vaga.', 'Recebe por email a <strong>convocatória</strong> com um convite de calendário (.ics) — aceite-o para a sessão ficar no Outlook. Na véspera chega um lembrete.', 'Nas sessões online, o botão <strong>Entrar na sessão</strong> aparece aos inscritos e fica activo 30 minutos antes; cada entrada fica registada.', 'No fim, o formador marca as <strong>presenças</strong>. A presença conclui a aula presencial; a ausência não.'])}
${callout('atencao', 'Não pode ir?', '<p>Cancele a inscrição na própria sessão: liberta o lugar para quem está em espera. Depois de a presença estar registada já não pode cancelar.</p>')}
<h2>Materiais da sessão</h2>
<p>O formador pode anexar materiais (apresentação, exercícios, checklist). Ficam visíveis aos inscritos, na sessão, para descarregar antes ou depois.</p>
${pergunta('A sessão é online. Onde está a ligação?', 'No email de convocatória e no botão "Entrar na sessão" da própria sessão, na página do curso — activo a partir de 30 minutos antes.')}
` },
    { titulo: 'Pontos, distintivos, ranking e trilhas', tipo: 'texto', duracao_min: 5, creditos: CRED, conteudo_texto: `
<p>A plataforma reconhece o esforço com pontos e distintivos. Não substituem a avaliação — são um incentivo e uma forma de ver o seu percurso.</p>
${tabela(['Acção', 'Pontos'], [['Concluir uma aula', '10'], ['Concluir um curso', '50'], ['Aprovar numa avaliação', '30 (+20 se tirar 100 %)'], ['Presença numa sessão', '20'], ['Comentário numa aula', '2 (máximo 5 por dia)'], ['Distintivo conquistado', '5 a 100, conforme o distintivo']])}
<h2>Distintivos</h2>
<p>Primeiro passo, Primeiro curso, Três cursos, Cinco cursos, À primeira (aprovado à primeira tentativa), Nota máxima, Em campo (sessão presencial), Maratonista (5 horas de estudo), Voz activa (5 comentários) e Sempre em dia (refrescamento). Aparecem em <strong>Os meus cursos</strong>, a cores quando conquistados.</p>
<h2>Níveis e ranking</h2>
<p>Iniciante → Aprendiz (100 pontos) → Praticante (300) → Especialista (700) → Mestre (1500). O <strong>top 5 da empresa</strong> aparece no mesmo cartão, com a sua posição.</p>
<h2>Trilhas</h2>
<p>Uma trilha é uma sequência de cursos recomendada para uma função. No separador Trilhas vê o progresso em cada uma; os cursos obrigatórios de uma trilha contam para a matriz de conformidade tal como os individuais.</p>
${pergunta('Os pontos influenciam a nota?', 'Não. A nota vem só da avaliação. Os pontos medem participação e regularidade.')}
` },
    { titulo: 'Prática guiada: o percurso do aluno (pacote interactivo)', tipo: 'html5', duracao_min: 15, conteudo_url: `${U}/html5/uc-percurso-aluno/index.html`, conclusao: 'automatica', opcoes: { norma: 'scorm12' }, creditos: 'Pacote SCORM 1.2 produzido internamente com o padrão curso-html5 da Universidade Corporativa.', materiais: [{ nome: 'uc-percurso-aluno.zip (pacote SCORM, para reutilizar noutro LMS)', url: `${U}/html5/uc-percurso-aluno.zip`, tamanho: 27000 }] },
  ],
};

const M5 = {
  titulo: 'Para instrutores: criar um curso', descricao: 'A Gestão de Formação, os dados do curso, os tipos de aula e a produção de conteúdos.',
  aulas: [
    { titulo: 'A Gestão de Formação: quem acede e os separadores', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>A <strong>Gestão de Formação</strong> é a área de quem cria e gere cursos. Aparece no menu Formação a quem tem o perfil <strong>instrutor</strong> ou é administrador.</p>
${fig('fig-gestao.svg', 'Os nove separadores da Gestão de Formação e, dentro de um curso, os sete separadores do editor.')}
<h2>Quem pode editar o quê</h2>
<ul><li>Um instrutor edita os cursos de que é <strong>responsável</strong>, <strong>co-instrutor</strong> ou <strong>criador</strong>. Os outros cursos vê-os em modo só-leitura (com aviso).</li><li>Administradores editam tudo e atribuem o perfil de instrutor no separador <strong>Instrutores</strong>.</li></ul>
<h2>Os separadores principais</h2>
${tabela(['Separador', 'O que faz lá'], [
  ['Visão geral', 'Conformidade por perfil e por aeroporto SGA, vencimentos a 30/60/90 dias, pendências com acções, avaliações, actividade mensal, horas de estudo; PDF.'],
  ['Cursos', 'Lista de cursos (publicados e rascunhos); "Novo curso"; abre o editor de cada curso.'],
  ['Alunos', 'Todos os colaboradores com a formação de cada um; abre a <strong>ficha do aluno</strong>; inscrever em massa nos obrigatórios em falta; lembretes; formação externa.'],
  ['Matriz', 'Colaboradores × cursos obrigatórios com o estado (válido, em curso, em falta, atrasado, a expirar, expirado); Excel e email.'],
  ['Trilhas', 'Criar percursos de cursos por função e marcá-los como obrigatórios.'],
  ['Perguntas', 'O banco global de perguntas (cada curso tem também o seu).'],
  ['Certificados', 'Todos os emitidos: revogar, reemitir, exportar.'],
  ['Assinantes', 'Quem assina os certificados (globais ou por curso), com assinatura digitalizada.'],
  ['Instrutores', 'Quem tem o perfil e que cursos cada um tem.'],
])}
<h2>O editor de um curso</h2>
<p>Ao abrir um curso vê o cabeçalho (interruptor <strong>Publicado</strong>, "Editar dados", "Ver como aluno", número da versão) e sete separadores: <strong>Conteúdo, Avaliação, Sessões, Alunos, Certificado, Analítica, Versões</strong>. As aulas seguintes percorrem-nos.</p>
${fig('fig-fluxo-instrutor.svg', 'O percurso do instrutor: criar, montar conteúdo, avaliação, certificado, publicar, alunos e sessões, acompanhar — e voltar ao conteúdo com o que a analítica mostra.')}
${pergunta('"Ver como aluno" inscreve-me no curso?', 'Não. Abre a página do curso como um aluno a veria, noutra aba. Para testar até ao fim (aulas, avaliação), inscreva-se no catálogo como qualquer colaborador.')}
` },
    { titulo: 'Criar um curso passo a passo', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
${passos(['Em <strong>Cursos</strong> carregue em <strong>Novo curso</strong>.', 'Preencha os dados (tabela abaixo). Só o título é obrigatório para criar; os restantes pode acertar depois em "Editar dados".', 'Guarde. O curso nasce como <strong>rascunho</strong>: não aparece no catálogo até o publicar.', 'Vá a <strong>Conteúdo</strong> e crie o primeiro módulo e as aulas (aula seguinte).', 'Crie a <strong>Avaliação</strong> e configure o <strong>Certificado</strong>.', 'Guarde uma <strong>Versão</strong> e ligue o interruptor <strong>Publicado</strong> (só possível com pelo menos uma aula).'])}
${tabela(['Campo', 'O que é e como decidir'], [
  ['Título e descrição', 'Escreva para o aluno: para quem é, o que vai saber fazer no fim, como funciona. Evite listas de normas sem explicação.'],
  ['Categoria e nível', 'Categoria livre (Operações, Safety…); nível iniciante/intermédio/avançado.'],
  ['Capa', 'Imagem 16:9. Sem capa, o cartão usa uma cor da categoria.'],
  ['Instrutor responsável e co-instrutores', 'Quem pode editar o curso e responde nos comentários.'],
  ['Carga horária', 'Calculada automaticamente: soma das durações das aulas, arredondada para cima. Indique a duração real em cada aula.'],
  ['Obrigatório para todos / para perfis', 'Torna o curso exigido: entra na matriz de conformidade e gera avisos por email. Use com critério.'],
  ['Prazo (dias)', 'Dias que o aluno tem para concluir depois da inscrição, quando obrigatório.'],
  ['Validade (meses)', 'Se o certificado expira. Activa os avisos a 30/7 dias e a recertificação.'],
  ['Tipo: inicial ou refrescamento', 'Um curso de refrescamento indica o curso base cuja validade renova.'],
  ['Sincronizar com a licença de condução', 'Para cursos de condução no lado ar: o certificado actualiza a licença no Safety.'],
  ['Créditos', 'Fontes e autorias do conteúdo; aparecem ao aluno.'],
])}
${callout('atencao', 'Publicar um curso obrigatório', '<p>No dia seguinte à publicação, todos os colaboradores dos perfis abrangidos que não estejam inscritos recebem o email "Formação obrigatória em falta". Confirme perfis e prazo antes de publicar.</p>')}
${pergunta('Posso criar o curso e deixá-lo por acabar?', 'Sim. Enquanto for rascunho ninguém o vê. Pode voltar quando quiser; nada é enviado a ninguém até publicar.')}
` },
    { titulo: 'Módulos e aulas: os tipos e como carregar cada um', tipo: 'texto', duracao_min: 12, creditos: CRED, conteudo_texto: `
<p>No separador <strong>Conteúdo</strong> cria módulos (capítulos) e, dentro deles, aulas. Pode reordenar por arrastar, editar (lápis) e apagar.</p>
${tabela(['Tipo de aula', 'O que carregar', 'Conclusão'], [
  ['Vídeo', 'Ligação do YouTube/Vimeo <em>ou</em> ficheiro .mp4/.webm (até 1 GB; com ffmpeg também .avi/.mov, convertidos no servidor). Opcional: legendas .vtt/.srt e poster.', 'Manual'],
  ['PDF', 'Ficheiro PDF <em>ou</em> PowerPoint/Word (.pptx/.docx…) convertido no servidor para PDF. Vídeos embutidos nos slides não passam para o PDF.', 'Manual'],
  ['Leitura (texto)', 'Escrito no editor rico (aula seguinte). Textos longos abrem em modo livro.', 'Manual'],
  ['Pacote HTML5', '.zip SCORM 1.2/2004 ou xAPI (eXeLearning, Adapt, Articulate, iSpring, curso-html5) — a norma é detectada; ou ficheiro .h5p (Lumi, h5p.org).', 'Automática (quando o pacote reporta) ou manual'],
  ['Ligação', 'URL interno (ex.: /Safety) ou externo.', 'Manual'],
  ['Sessão presencial', 'Descrição; depois ligue-a a uma sessão no separador Sessões.', 'Presença marcada pelo formador'],
])}
<h2>Em todas as aulas</h2>
<ul><li><strong>Duração (min)</strong> — obrigatória para a carga horária ficar certa.</li><li><strong>Materiais para download</strong> — PDF, Office, imagens, zip, áudio (até 1 GB cada).</li><li><strong>Créditos</strong> — a fonte do conteúdo.</li></ul>
<h2>Carregar ficheiros grandes</h2>
<p>O carregamento mostra a percentagem e, para Office e vídeos, a fase "a converter no servidor". Um PowerPoint de 200 MB com vídeos embutidos fica num PDF de poucos MB: os vídeos são retirados (a plataforma avisa) e devem ser carregados como aulas de vídeo.</p>
${acordeao([
  ['Boas práticas de duração', '<p>Aulas de 5 a 25 minutos. Um vídeo de 60 minutos rende mais dividido em três. Uma leitura com mais de 2500 caracteres abre em modo livro — está pensado para isso.</p>'],
  ['Vídeos do YouTube: o que verificar', '<p>Confirme o canal (fonte credível), ligue as legendas em português (o leitor pede-as por omissão) e escreva os créditos: canal, título, "reproduzido por ligação". O aluno não consegue sair para o YouTube a partir da aula.</p>'],
  ['Ordem das aulas', '<p>Alterne exposição (vídeo/leitura) com prática (actividade). Termine cada módulo com algo activo. Evite juntar todos os vídeos no fim.</p>'],
])}
${pergunta('Carreguei um .zip e a aula ficou "sem norma". Que faço?', 'O pacote não tem imsmanifest.xml nem tincan.xml — é HTML simples. Funciona, mas conclui-se manualmente. Se o exportou de uma ferramenta, escolha a exportação SCORM 1.2.')}
` },
    { titulo: 'O editor de texto e os blocos ricos', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>As leituras escrevem-se num editor simples: negrito, itálico, títulos, listas, citações, ligações e o menu <strong>Inserir bloco</strong>. Cada bloco tem um aspecto reconhecível pelo aluno (viu-os no módulo 3).</p>
${tabela(['Bloco', 'Quando usar'], [
  ['Nota informativa (azul)', 'Contexto, definição, "para saber mais".'], ['Atenção (âmbar)', 'Erros frequentes, condições, limites.'], ['Perigo (vermelho)', 'Regras de segurança sem excepção.'], ['Dica (verde)', 'Boas práticas, atalhos.'],
  ['Acordeão', 'Detalhe opcional que não deve interromper a leitura (FAQ, exemplos longos).'], ['Pergunta com resposta escondida', 'Auto-teste durante a leitura: o aluno pensa antes de revelar.'],
  ['Duas colunas', 'Comparações (antes/depois, aluno/instrutor).'], ['Passos numerados', 'Procedimentos.'], ['Tabela', 'Dados, critérios, referências.'], ['Imagem com legenda', 'Figuras, esquemas, fotos com fonte.'],
])}
<h2>Escrever bem para ecrã</h2>
<ul><li>Frases curtas, uma ideia por parágrafo, títulos a cada 3–5 parágrafos.</li><li>Comece pelo "porquê" e pelo "o que vai saber fazer".</li><li>Termine cada leitura com uma pergunta escondida ou uma actividade.</li><li>Português de Portugal, sem anglicismos desnecessários; siglas explicadas na primeira vez.</li></ul>
<h2>Editar o HTML</h2>
<p>O botão <strong>&lt;/&gt;</strong> mostra o HTML para ajustes finos. A plataforma limpa automaticamente scripts e estilos inseguros ao mostrar a aula.</p>
${pergunta('Posso colar texto do Word?', 'Pode, mas cole como texto simples (Ctrl+Shift+V) e formate no editor: evita estilos estranhos.')}
` },
    { titulo: 'Produzir conteúdos interactivos: curso-html5, eXeLearning, Lumi (H5P) e Adapt', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
<p>Quando quer mais do que texto e vídeo — actividades, simulações, cartões, arrastar e largar — tem quatro caminhos. Todos gratuitos, todos a correr dentro da plataforma.</p>
${tabela(['Caminho', 'Quem faz', 'O que sai', 'Como entra na plataforma'], [
  ['<strong>curso-html5</strong> (padrão interno)', 'O assistente do DIROPS, a partir do seu conteúdo (manual, PPT, tópicos)', 'Pacote SCORM com páginas, flashcards, arrastar, ordenar, checklist e quiz, com a identidade SGA', 'Aula "Pacote HTML5" › carregar o .zip; conclusão automática'],
  ['<strong>eXeLearning</strong>', 'Qualquer instrutor, sem programar (instalador em installers\\eXeLearning ou app.exelearning.net)', 'Páginas e actividades (iDevices); exporta SCORM 1.2', 'Aula "Pacote HTML5" › carregar o .zip SCORM'],
  ['<strong>Lumi</strong> (H5P)', 'Qualquer instrutor (installers\\Lumi)', 'Conteúdos .h5p: vídeo interactivo, apresentação, quiz, lacunas, arrastar, cartões, cronologia…', 'Aula "Pacote HTML5" › "Carregar H5P (.h5p)"'],
  ['<strong>Adapt Learning</strong>', 'Equipas com apoio técnico (Node.js)', 'Cursos responsivos muito completos; exporta SCORM 1.2', 'Aula "Pacote HTML5" › carregar o .zip'],
])}
<h2>Qual escolher</h2>
${colunas([
  '<p><strong>Peça um curso-html5</strong> quando tem a matéria (um instrutivo, uma apresentação, um manual) e quer um curso interactivo pronto rapidamente, com a marca SGA. Basta dizer "crie um curso sobre X usando a skill curso-html5" — este módulo tem um exemplo no fim do módulo 4.</p>',
  '<p><strong>Use eXeLearning ou Lumi</strong> quando quer produzir e ajustar você mesmo, sem depender de ninguém. O eXeLearning é melhor para "páginas com actividades"; o Lumi para actividades avulsas (um quiz, um vídeo com perguntas, um jogo de memória).</p>',
])}
${callout('atencao', 'Avaliações que contam para o certificado', '<p>Os quizzes dentro dos pacotes (SCORM/H5P) são de treino: as respostas certas viajam com o pacote. A avaliação oficial deve ser sempre o quiz da plataforma (separador Avaliação): correcção no servidor, modo sem consulta e registos de integridade.</p>')}
<h2>Vídeos</h2>
<ul><li>Do YouTube: cole a ligação; verifique canal e legendas; escreva os créditos.</li><li>Gravados pela SGA (.mp4): carregue na aula; se tiver legendas, anexe o .vtt; um poster (imagem) fica bem no início.</li><li>Este curso tem um vídeo produzido internamente com ffmpeg a partir de slides — um exemplo de vídeo "de apresentação" sem câmara.</li></ul>
${pergunta('Que ferramenta usar para uma simulação de decisão (escolhas com consequências)?', 'Lumi › "Branching Scenario" (H5P) ou eXeLearning; para algo mais elaborado, Adapt. Comece pelo Lumi.')}
` },
    { titulo: 'Perguntas frequentes de quem cria cursos (H5P)', tipo: 'html5', duracao_min: 5, conteudo_url: `${U}/h5p/uc-faq-instrutor/`, conclusao: 'manual', opcoes: { norma: 'h5p', main_library: 'H5P.Accordion' }, creditos: 'Actividade H5P (Accordion) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

const M6 = {
  titulo: 'Para instrutores: avaliação, certificado e sessões', descricao: 'Banco de perguntas, construtor do quiz, correcção e integridade, certificado e sessões.',
  aulas: [
    { titulo: 'Banco de perguntas e construtor da avaliação', tipo: 'texto', duracao_min: 12, creditos: CRED, conteudo_texto: `
<p>A avaliação constrói-se em dois passos: primeiro o <strong>banco de perguntas</strong> do curso, depois a composição do <strong>quiz</strong>.</p>
<h2>1. O banco de perguntas</h2>
${passos(['No separador <strong>Avaliação</strong> › "Banco do curso" carregue em "Nova pergunta".', 'Escolha o tipo (dez tipos — tabela abaixo), escreva o enunciado, as opções e a <strong>explicação</strong> (o aluno vê-a na revisão).', 'Dê uma <strong>categoria</strong> (ex.: "RCAM", "Fraseologia") — serve para sortear perguntas por tema.', 'Para ponto na imagem e rótulos, carregue a figura e desenhe as zonas sobre ela.', 'Pode importar perguntas de Excel (modelo disponível) e reutilizar o banco global.'])}
${tabela(['Tipo', 'Boas práticas'], [
  ['Escolha única / múltipla', '4 opções plausíveis; evite "todas as anteriores". Na múltipla, a pontuação é parcial (certas menos erradas).'],
  ['Verdadeiro / Falso', 'Afirmações claras, uma ideia cada.'],
  ['Lacuna', 'Indique todas as respostas aceites (sinónimos, com e sem acento).'],
  ['Numérica', 'Defina a tolerância (ex.: 25 ± 1).'],
  ['Ordenação', 'Escreva os itens na ordem certa; o aluno recebe-os baralhados.'],
  ['Correspondência', 'Pares termo ↔ definição; a coluna da direita é baralhada.'],
  ['Ponto na imagem', 'Uma ou mais zonas correctas; a zona deve ter tamanho razoável.'],
  ['Rótulos na imagem', 'Zonas numeradas + lista de rótulos; pontuação parcial por zona.'],
  ['Resposta aberta', 'Escreva a rubrica (o que tem de conter); corrija no separador Resultados.'],
])}
<h2>2. O quiz</h2>
${tabela(['Definição', 'Efeito'], [
  ['Itens fixos ou sorteio', 'Fixos: perguntas escolhidas uma a uma. Sorteio: "N perguntas da categoria X" — cada aluno recebe um conjunto diferente.'],
  ['Baralhar perguntas / opções', 'Ordem diferente por tentativa.'],
  ['Nota mínima', 'Percentagem para aprovar (70 % é o habitual).'],
  ['Tentativas máximas', '2 ou 3; sem limite se vazio.'],
  ['Tempo limite (min)', 'Submissão automática quando termina.'],
  ['Exige aulas concluídas', 'O aluno só inicia depois de concluir todas as aulas.'],
  ['Modo sem consulta', 'Ecrã inteiro e registo de saídas, cópias e DevTools (ver aula seguinte).'],
  ['Gera certificado', 'A aprovação conclui o curso e emite o certificado.'],
  ['Rever depois', 'O aluno vê a correcção com o gabarito depois de submeter.'],
  ['Faixas de feedback', 'Mensagem por intervalo de nota (ex.: 0–69 "reveja…", 70–100 "parabéns").'],
])}
${callout('dica', 'Teste como aluno', '<p>Inscreva-se no seu próprio curso pelo catálogo e faça a avaliação de ponta a ponta antes de publicar. Depois peça ao gestor para remover a sua matrícula de teste.</p>')}
${pergunta('Alterei uma pergunta depois de alunos terem feito o quiz. E as tentativas antigas?', 'Não mudam: cada tentativa guarda o retrato das perguntas e do gabarito no momento. A alteração vale para tentativas futuras.')}
` },
    { titulo: 'Correcção manual, resultados e integridade', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>No separador <strong>Avaliação › Resultados</strong> vê todas as tentativas: aluno, número da tentativa, nota, estado (aprovado, reprovado, a aguardar correcção), tempo gasto e ciclo.</p>
<h2>Corrigir respostas abertas</h2>
${passos(['Tentativas com "a aguardar correcção" têm o botão <strong>Corrigir</strong>.', 'Para cada resposta aberta vê a rubrica, a resposta do aluno e um campo de pontos e comentário.', 'Ao guardar, a nota final é calculada: se aprova, o curso conclui e o certificado sai nesse momento; o aluno recebe o email.'])}
<h2>Integridade da tentativa</h2>
<p>Quando o quiz é "sem consulta", a correcção mostra um resumo de integridade: <strong>saídas do ecrã</strong> (mudou de janela ou separador), <strong>acções bloqueadas</strong> (copiar, menu de contexto, atalhos F12/Ctrl+Shift+I/Ctrl+U…) e <strong>aberturas de ferramentas de programador</strong> detectadas. Cada evento tem hora.</p>
${callout('info', 'O que isto garante e o que não garante', '<p>Garante que as respostas certas nunca saem do servidor (a correcção é feita lá) e que comportamentos suspeitos ficam registados com hora. Não impede que alguém consulte outro dispositivo ou peça ajuda a um colega — para isso servem a sessão presencial vigiada ou a resposta aberta. Use os registos como indício, não como prova.</p>')}
<h2>Analítica das perguntas</h2>
<p>No separador <strong>Analítica</strong> do curso vê a percentagem de acerto de cada pergunta e a tendência mês a mês. Perguntas com acerto muito baixo podem estar mal formuladas ou a matéria pode estar mal explicada — é o sinal para rever a aula ou a pergunta.</p>
${pergunta('Um aluno tem 6 "saídas do ecrã". Reprovo-o?', 'Não automaticamente. Fale com ele: pode ter sido uma chamada ou uma janela de notificação. Os registos servem para uma conversa informada e, se for o caso, para reabrir a avaliação em condições vigiadas.')}
` },
    { titulo: 'O certificado: editor visual, signatários e numeração', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Cada curso tem o seu certificado, configurado no separador <strong>Certificado</strong> com um editor visual sobre a arte oficial da SGA.</p>
${passos(['Escolha os <strong>signatários</strong> (globais, definidos em Assinantes, ou específicos deste curso) — cargo, nome e assinatura digitalizada.', 'Edite os <strong>textos</strong>: título, "certifica-se que", descrição com duração e local, data e local de emissão. Pode usar {nome}, {curso}, {horas}, {data}.', 'Arraste os elementos sobre a arte para os posicionar; as setas do teclado ajustam 0,5 %. Pode adicionar caixas de texto livres.', 'No verso ficam os <strong>temas</strong> (os módulos do curso) — mantenha os títulos dos módulos legíveis.', 'Pré-visualize com "Gerar exemplo" e guarde.'])}
<h2>Numeração e validação</h2>
<ul><li>Cada certificado recebe um número único (ex.: DIROPS-2026-0001) e um código de validação; a página pública de validação confirma nome, curso, data e validade.</li><li>A <strong>validade</strong> vem dos dados do curso (meses). Se o curso é de refrescamento, a validade renova a do curso base.</li><li>No separador Certificados pode revogar (com motivo) e reemitir.</li></ul>
${callout('atencao', 'Licença de condução', '<p>Se o curso tem "Sincronizar com a licença de condução" ligado, a emissão do certificado cria ou renova a licença no módulo Safety com a mesma validade. Confirme a opção antes de emitir em massa.</p>')}
${pergunta('Posso emitir um certificado sem avaliação?', 'Sim: no separador Alunos, "Emitir certificado" para um aluno com o curso concluído. Fica igual ao automático, com o número seguinte.')}
` },
    { titulo: 'Sessões: agendar, convocar, presenças e folha', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
<p>O separador <strong>Sessões</strong> gere a componente presencial ou online de um curso.</p>
${passos(['Crie no Conteúdo uma aula do tipo <strong>Sessão presencial</strong> (com a descrição do que acontece e o que trazer).', 'Em Sessões, <strong>Nova sessão</strong>: título, <strong>modalidade</strong> (presencial, online ou híbrida), plataforma e ligação (Teams/Meet) quando online, início e fim, local e aeroporto, formador, <strong>lugares na sala</strong> (o online não tem limite), a aula presencial que a presença conclui, materiais e notas internas.', 'Os alunos inscrevem-se na página do curso. Pode também <strong>adicionar alunos</strong> em "Presenças" — recebem a convocatória com o convite .ics.', 'Use <strong>Convocar</strong> para enviar (ou reenviar) a convocatória a todos os inscritos.', 'No dia, abra <strong>Presenças</strong>: marque presente/ausente aluno a aluno ou "Todos presentes"; nas sessões online vê a hora a que cada um entrou pela ligação.', 'Imprima a <strong>folha de presenças</strong> (PDF, com secção para assinaturas na sala e registo de entradas online). Marque a sessão como <strong>realizada</strong>.'])}
${tabela(['Situação', 'O que acontece'], [
  ['Sala cheia', 'Os seguintes ficam em lista de espera; um cancelamento promove o primeiro.'],
  ['Cancelar a sessão', 'Todos os inscritos recebem email de cancelamento (com .ics de cancelamento).'],
  ['Presença marcada', 'A aula presencial ligada fica concluída para esse aluno; a matrícula recalcula o progresso.'],
  ['Véspera', 'Lembrete automático por email a quem está inscrito.'],
])}
${pergunta('Uma sessão híbrida tem 10 lugares. Quantos podem inscrever-se online?', 'Sem limite. Os lugares contam só para quem participa na sala.')}
` },
    { titulo: 'Onde se faz o quê? (H5P, arrastar e largar)', tipo: 'html5', duracao_min: 5, conteudo_url: `${U}/h5p/uc-arrastar-separadores/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.DragQuestion' }, creditos: 'Actividade H5P (Drag and Drop) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

const M7 = {
  titulo: 'Para gestores: acompanhar pessoas e conformidade', descricao: 'Alunos, ficha, matriz, visão geral, analítica, versões e relatórios automáticos.',
  aulas: [
    { titulo: 'Alunos do curso, ficha do aluno, inscrição em massa e lembretes', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<h2>No curso (separador Alunos)</h2>
<ul><li>Lista de inscritos com data, progresso, estado, ciclo, conclusão, validade, dias e certificado; Excel e PDF.</li><li><strong>Inscrever</strong> colaboradores (com email imediato) e <strong>Inscrever em falta</strong>: todos os que devem fazer o curso e ainda não estão inscritos.</li><li><strong>Lembrete</strong> por email a um ou vários alunos, com mensagem própria.</li><li>Emitir certificado, reabrir num novo ciclo (recertificação manual), remover matrícula.</li></ul>
<h2>Na Gestão (separador Alunos › ficha)</h2>
<p>A <strong>ficha do aluno</strong> é a vista completa de uma pessoa: cursos (com aulas concluídas e tempo por aula), avaliações e tentativas (com correcção), certificados, formação externa, licenças de condução (Safety) e todas as notificações enviadas. Exporta para Excel e PDF.</p>
<h2>Formação externa</h2>
<p>Cursos feitos fora da plataforma (ANAC, fabricante, universidade) registam-se na ficha com data, validade e comprovativo. Se corresponderem a um curso obrigatório, <strong>contam na matriz</strong> como válidos.</p>
${callout('dica', 'Inscrever em massa nos obrigatórios', '<p>"Inscrever em falta" no curso (ou na ficha) cria as matrículas de uma vez e envia o email de inscrição a cada um. É a forma mais rápida de arrancar com um curso obrigatório novo.</p>')}
${pergunta('Um colaborador fez o curso na ANAC. Como fica "em dia" na matriz?', 'Registe a formação externa na ficha dele, ligada ao curso obrigatório correspondente, com a data e a validade. Passa a "válido (externa)".')}
` },
    { titulo: 'Matriz, visão geral, analítica e exportações', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<h2>Matriz de formação</h2>
<p>Colaboradores × cursos obrigatórios. Cada célula tem um estado: <strong>válido</strong>, <strong>em curso</strong>, <strong>em falta</strong>, <strong>atrasado</strong>, <strong>a expirar</strong>, <strong>expirado</strong>, com a data de validade e os dias. Filtre por perfil e aeroporto; exporte para Excel; envie a matriz por email.</p>
<h2>Visão geral</h2>
<p>O painel para a direcção: conformidade global e por perfil e por aeroporto SGA, vencimentos a 30/60/90 dias com acção directa (lembrete, inscrever), avaliações por curso (aprovação, nota média, por corrigir), actividade dos últimos 12 meses, horas de estudo, formação externa. Tudo exportável para PDF com o logo SGA.</p>
<h2>Analítica do curso</h2>
<ul><li><strong>Funil por aula</strong>: percentagem de inscritos que concluiu cada aula, tempo médio face ao previsto, visitas, e "pararam aqui" — onde os alunos desistem.</li><li><strong>Dificuldade das perguntas</strong> com tendência mensal.</li><li><strong>Por aeroporto</strong>: inscritos, conclusão, aprovação, nota média.</li></ul>
${callout('info', 'Como usar a analítica', '<p>Uma aula onde muitos "param" está demasiado longa ou confusa: divida-a ou reescreva-a. Uma pergunta com 20 % de acerto está mal formulada ou a matéria não está explicada: corrija uma das duas. Guarde uma versão antes de mudar.</p>')}
<h2>Exportações</h2>
<p>Todas as tabelas (alunos, matriz, resultados, sessões, analítica, ficha) exportam para <strong>Excel</strong> e <strong>PDF</strong>, com o logo SGA e a data de geração.</p>
${pergunta('A direcção quer um número: "quantos por cento estão em dia?"', 'Visão geral › Conformidade: obrigatórios válidos ÷ obrigatórios devidos, global e por perfil/aeroporto. O mesmo número segue no relatório semanal por email.')}
` },
    { titulo: 'Versões do curso, comentários, gamificação e relatórios automáticos', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<h2>Versões</h2>
<p>No separador <strong>Versões</strong>, "Guardar versão" tira um retrato de módulos, aulas, banco de perguntas e avaliações. Cada inscrição e certificado ficam ligados à versão em vigor. Pode <strong>comparar</strong> uma versão com o conteúdo actual (aulas removidas, novas, alteradas) e <strong>restaurar</strong> — o restauro grava uma versão nova, nada se perde.</p>
<h2>Comentários</h2>
<p>Responda às perguntas dos alunos nas aulas (aparece com o distintivo "Instrutor"); fixe respostas úteis no topo; apague o que for impróprio. Perguntas repetidas são um sinal para melhorar a aula.</p>
<h2>Gamificação</h2>
<p>Os pontos e distintivos são atribuídos automaticamente (aula, curso, avaliação, presença, comentário). Não há nada a configurar; o ranking mostra os cinco primeiros da empresa.</p>
<h2>O que sai por email sem intervenção</h2>
${tabela(['Automatismo', 'Quando'], [['Notificações aos colaboradores (inscrição, lembretes, a expirar, expirado, em falta, certificado, sessão amanhã)', 'Todos os dias de manhã'], ['Relatório semanal de formação à gestão (conformidade, vencimentos, pendências)', 'Semanalmente'], ['Convocatórias e cancelamentos de sessões', 'No momento da acção do instrutor']])}
${callout('dica', 'Antes de mudar um curso publicado', '<p>Guarde uma versão, faça as alterações, teste "como aluno" e, se for uma mudança grande, informe os inscritos com um lembrete personalizado.</p>')}
${pergunta('Restaurei uma versão antiga e apareceu "v5". Porquê?', 'O restauro nunca apaga história: grava o conteúdo restaurado como uma versão nova (v5) e marca a origem como "restauro".')}
` },
    { titulo: 'Abrir a Gestão de Formação', tipo: 'link', duracao_min: 2, conteudo_url: '/GestaoFormacao', creditos: CRED },
    { titulo: 'Guia do Utilizador do DIROPS (referência)', tipo: 'link', duracao_min: 3, conteudo_url: '/GuiaUtilizador', creditos: CRED },
  ],
};

export const MODULOS = [M1, M2, M3, M4, M5, M6, M7];

// ─────────────────────────────────────────────────────────────────────────────
// Banco de perguntas: todos os tipos da plataforma.
const op = (arr) => arr.map(([texto, correta], i) => ({ id: String.fromCharCode(97 + i), texto, correta: !!correta }));
export const PERGUNTAS = [
  { categoria: 'Aluno', tipo: 'escolha_unica', enunciado: 'Onde encontra os cursos que já começou, o seu progresso e os seus pontos?', opcoes: op([['No separador Catálogo', false], ['No separador Os meus cursos', true], ['No separador Certificados', false], ['No menu Suporte', false]]), explicacao: '"Os meus cursos" reúne o que já começou, o progresso, os pontos e os distintivos.' },
  { categoria: 'Aluno', tipo: 'escolha_unica', enunciado: 'O distintivo laranja "Obrigatório" num cartão do catálogo significa que…', opcoes: op([['o curso é o mais popular', false], ['o curso é exigido para o seu perfil e tem, normalmente, um prazo', true], ['o curso é pago', false], ['o curso está quase a expirar', false]]), explicacao: 'Só aparece nos cursos obrigatórios para o perfil do utilizador; o prazo conta desde a inscrição.' },
  { categoria: 'Aluno', tipo: 'vf', enunciado: 'Nas aulas de vídeo, leitura e PDF é o aluno que conclui a aula com o botão "Concluir e avançar".', opcoes: op([['Verdadeiro', true], ['Falso', false]]), explicacao: 'Só as actividades interactivas com pontuação e as sessões presenciais se concluem sozinhas.' },
  { categoria: 'Aluno', tipo: 'escolha_multipla', enunciado: 'Quais destas coisas ficam guardadas quando fecha o browser a meio de um curso?', opcoes: op([['As aulas concluídas', true], ['A posição em que ficou no vídeo', true], ['As respostas já dadas numa avaliação em curso', true], ['A cor do tema do computador', false]]), explicacao: 'Aulas, posição do vídeo, página do livro e respostas da tentativa em curso ficam guardadas.' },
  { categoria: 'Aluno', tipo: 'vf', enunciado: 'Se o tempo da avaliação terminar, a tentativa é anulada e perde-se tudo.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'A avaliação é submetida automaticamente com as respostas gravadas até então.' },
  { categoria: 'Aluno', tipo: 'lacuna', enunciado: 'Quando a validade de um certificado está a terminar, o botão do curso passa a "________".', opcoes: [{ id: 'a', texto: 'Recertificar' }, { id: 'b', texto: 'recertificar' }], explicacao: '"Recertificar" reabre o curso num novo ciclo ou abre o curso de refrescamento.' },
  { categoria: 'Aluno', tipo: 'numerica', enunciado: 'Quantos dias antes do fim da validade chega o primeiro aviso por email? (número)', opcoes: [{ valor: 30, tolerancia: 0 }], explicacao: 'Avisos a 30 e a 7 dias do fim da validade; no dia da expiração, aviso de expirado.' },
  { categoria: 'Aluno', tipo: 'ordenacao', enunciado: 'Coloque pela ordem correcta o percurso de um aluno.', opcoes: [{ id: 'a', texto: 'Escolher o curso no catálogo' }, { id: 'b', texto: 'Inscrever-se' }, { id: 'c', texto: 'Concluir as aulas' }, { id: 'd', texto: 'Fazer a avaliação final' }, { id: 'e', texto: 'Descarregar o certificado' }], explicacao: 'Catálogo → inscrição → aulas → avaliação → certificado (→ recertificação quando a validade termina).' },
  { categoria: 'Aluno', tipo: 'correspondencia', enunciado: 'Ligue cada tipo de aula à forma como se conclui.', opcoes: [{ id: 'a', esquerda: 'Vídeo do YouTube', direita: 'Botão "Concluir e avançar"' }, { id: 'b', esquerda: 'Pacote SCORM com quiz', direita: 'Sozinha, quando o pacote reporta a conclusão' }, { id: 'c', esquerda: 'Sessão presencial', direita: 'Quando o formador marca a presença' }, { id: 'd', esquerda: 'Resposta aberta na avaliação', direita: 'Corrigida pelo instrutor; nota fica pendente' }], explicacao: 'Cada tipo tem a sua regra de conclusão.' },
  { categoria: 'Aluno', tipo: 'hotspot', enunciado: 'Na figura do leitor de aulas, clique no botão que conclui a aula e passa à seguinte.', imagem_url: `${U}/uc/fig-mapa-aula.svg`, opcoes: [{ id: 'z1', x: 24.2, y: 80.3, w: 21.6, h: 5.7 }], explicacao: 'O botão "Concluir e avançar" fica na barra de acções, por baixo do conteúdo.' },
  { categoria: 'Aluno', tipo: 'rotulos', enunciado: 'Associe cada rótulo à área correspondente do leitor de aulas.', imagem_url: `${U}/uc/fig-mapa-aula.svg`, opcoes: [{ id: 'z1', x: 3, y: 20, w: 64, h: 55, rotulo: 'Conteúdo da aula' }, { id: 'z2', x: 3, y: 78.3, w: 64, h: 9.3, rotulo: 'Barra de acções' }, { id: 'z3', x: 3, y: 90, w: 64, h: 8, rotulo: 'Comentários' }, { id: 'z4', x: 70, y: 20, w: 27, h: 67.7, rotulo: 'Índice e progresso' }], explicacao: 'A: conteúdo; B: barra de acções; C: comentários; D: índice com o progresso.' },
  { categoria: 'Aluno', tipo: 'escolha_unica', enunciado: 'Numa sessão híbrida com 10 lugares na sala, quantas pessoas podem inscrever-se online?', opcoes: op([['Nenhuma', false], ['Até 10', false], ['Sem limite', true], ['Só quem estiver em lista de espera', false]]), explicacao: 'Os lugares limitam só a participação presencial.' },
  { categoria: 'Instrutor', tipo: 'escolha_unica', enunciado: 'Como é calculada a carga horária de um curso?', opcoes: op([['Escrita à mão pelo instrutor', false], ['Soma das durações das aulas, arredondada para cima à hora', true], ['Tempo médio que os alunos demoraram', false], ['Número de módulos × 1 hora', false]]), explicacao: 'É automática; por isso cada aula deve ter a duração real preenchida.' },
  { categoria: 'Instrutor', tipo: 'escolha_multipla', enunciado: 'O que acontece quando publica um curso obrigatório para um perfil?', opcoes: op([['Aparece no catálogo', true], ['Os colaboradores desse perfil sem inscrição recebem o email "formação obrigatória em falta"', true], ['A matriz passa a mostrá-los "em falta"', true], ['Todos ficam automaticamente aprovados', false]]), explicacao: 'Publicar torna o curso visível e activa a conformidade e os avisos.' },
  { categoria: 'Instrutor', tipo: 'vf', enunciado: 'Os quizzes dentro de um pacote SCORM ou H5P servem como avaliação oficial para o certificado.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'São de treino: as respostas viajam com o pacote. A avaliação oficial é o quiz da plataforma, corrigido no servidor.' },
  { categoria: 'Instrutor', tipo: 'rotulos', enunciado: 'Na Gestão de Formação, associe cada rótulo ao separador do editor do curso onde a tarefa se faz (zonas numeradas da esquerda para a direita, na fila de separadores do curso).', imagem_url: `${U}/uc/fig-gestao.svg`, opcoes: [{ id: 'z1', x: 5, y: 60.7, w: 10.4, h: 5.4, rotulo: 'Criar módulos e aulas' }, { id: 'z2', x: 16, y: 60.7, w: 10.4, h: 5.4, rotulo: 'Construir o quiz' }, { id: 'z3', x: 27, y: 60.7, w: 9.6, h: 5.4, rotulo: 'Agendar sessão online' }, { id: 'z4', x: 58.2, y: 60.7, w: 10.4, h: 5.4, rotulo: 'Ver o funil por aula' }], explicacao: 'Conteúdo → módulos e aulas; Avaliação → quiz; Sessões → sessões; Analítica → funil por aula.' },
  { categoria: 'Instrutor', tipo: 'aberta', enunciado: 'Em duas ou três frases: um aluno teve 6 "saídas do ecrã" numa avaliação sem consulta e nota 85 %. O que faria e porquê?', opcoes: [{ max_chars: 600, rubrica: 'Não reprovar automaticamente; falar com o aluno (causas legítimas possíveis: chamada, notificação); usar os registos como indício; se necessário reabrir a avaliação em condições vigiadas ou complementar com resposta aberta/sessão presencial.' }], pontos: 2, explicacao: 'Os registos de integridade são indícios para uma conversa informada, não prova de fraude.' },
];

export const QUIZ = {
  titulo: 'Avaliação — Como usar a Universidade Corporativa', ativo: true, ordem: 1, nota_minima: 70, tentativas_max: 3, tempo_limite_min: 30,
  baralhar_perguntas: true, baralhar_opcoes: true, rever_apos: true, gera_certificado: true, requer_aulas_concluidas: true, modo_sem_consulta: false,
  feedback_faixas: [{ min: 0, max: 69, mensagem: 'Reveja as aulas assinaladas na revisão e tente de novo — tem 3 tentativas.' }, { min: 70, max: 89, mensagem: 'Aprovado! Já sabe usar a plataforma.' }, { min: 90, max: 100, mensagem: 'Excelente — está pronto para ajudar os colegas.' }],
};
