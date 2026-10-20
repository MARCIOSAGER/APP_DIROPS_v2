// Conteúdo do curso "Como usar o Portal de Documentos (GED)" (pt-PT).
// HTML das aulas usa os blocos do editor rico (.prose-aula): callout, acordeao, pergunta-inline, colunas, passos, table, figure.
// Molde: tools/curso-uc/conteudo.mjs. Versão com CAPTURAS DE ECRÃ REAIS (2026-10-04) e linguagem para quem nunca usou
// um computador — mostra onde clicar, não só conta. As imagens vivem em uploads/ged-curso/ (capturas do portal real).
const U = '/storage/v1/object/public/uploads';

// figura com legenda; `nome` é o ficheiro em uploads/ged-curso/ (ex.: 'inicio.png')
const fig = (nome, legenda) => `<figure><img src="${U}/ged-curso/${nome}" alt="${legenda}" /><figcaption>${legenda}</figcaption></figure>`;
const callout = (estilo, titulo, html) => `<div class="callout callout-${estilo}"><div class="callout-corpo"><p class="callout-titulo">${titulo}</p>${html}</div></div>`;
const acordeao = (itens) => itens.map(([t, h]) => `<details class="acordeao"><summary>${t}</summary>${h}</details>`).join('');
const pergunta = (p, r) => `<details class="pergunta-inline"><summary>${p}</summary><p><strong>Resposta:</strong> ${r}</p></details>`;
const passos = (itens) => `<ol class="passos">${itens.map(i => `<li>${i}</li>`).join('')}</ol>`;
const tabela = (cab, linhas) => `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const CRED = 'Conteúdo produzido internamente pela Direcção de Operações — SGA (Outubro 2026).';
// opções de escolha: [[texto, correcta], ...]
const op = (arr) => arr.map(([texto, correta], i) => ({ id: String.fromCharCode(97 + i), texto, correta }));

// Campos comuns aos três cursos do GED (categoria, nível, etc.). Cada curso acrescenta o seu título/descrição/capa.
const BASE = { categoria: 'Portal de Documentos', nivel: 'iniciante', publicado: true, tipo_formacao: 'inicial', validade_meses: null, prazo_dias: null, obrigatorio_todos: false, obrigatorio_perfis: [] };

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — O essencial
const M1 = {
  titulo: 'O essencial: o que é o GED e porque existe',
  descricao: 'O que é o portal, que problema resolve e o vocabulário que vai encontrar.',
  aulas: [
    { titulo: 'O que é o Portal de Documentos e porque existe', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>O <strong>Portal de Documentos</strong> (também chamado <strong>GED</strong> — Gestão Electrónica de Documentos, ou simplesmente <strong>Sistema GED</strong>) é onde a SGA guarda, de forma <em>controlada</em>, os manuais e documentos dos seus aeroportos: o Manual de Operações do Aeródromo, os programas de segurança, os planos de emergência, os procedimentos, as fichas e os mapas.</p>
${callout('info', 'O que quer dizer «controlado»', '<p>Não é uma pasta de ficheiros. Um documento controlado tem uma <strong>versão válida e só uma</strong>, sabe-se <strong>quem o pode ver</strong>, regista-se <strong>quem o leu</strong> e <strong>quem o aprovou</strong>, e guarda-se a história de todas as alterações. É isto que uma inspecção da ANAC espera encontrar.</p>')}
<p>O problema que resolve é simples de enunciar e caro de ter: <strong>pessoas diferentes a trabalhar com versões diferentes do mesmo documento</strong>. Quando cada um guarda a sua cópia no computador, ninguém sabe qual é a boa. O portal acaba com isso — há um sítio só, e o que lá está «Em vigor» é a verdade.</p>
${callout('aviso', 'A regra de ouro', '<p>Use sempre o documento <strong>do portal</strong>. Nunca a cópia que tem no computador ou impressa na gaveta — essa pode estar desactualizada e você não dá por isso.</p>')}
` },
    { titulo: 'Entrar no portal, passo a passo', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Começamos pelo princípio: entrar. Abra o navegador da internet (o Chrome, o Edge — o programa que usa para ver sites) e escreva, em cima, o endereço do portal que lhe deram. Aparece este ecrã:</p>
${fig('login.png', 'O ecrã de entrada: à esquerda a apresentação; à direita, onde escreve o email e a senha.')}
${passos([
  'No campo <strong>Email</strong>, escreva o seu endereço de email da SGA (termina em @sga.co.ao).',
  'No campo <strong>Senha</strong>, escreva a sua senha. Se quiser ver o que escreveu, carregue no desenho do olho à direita.',
  'Carregue no botão azul <strong>«Entrar nos documentos»</strong>.',
])}
${callout('dica', 'Esqueceu-se da senha?', '<p>Carregue em <strong>«Esqueci a senha»</strong>, por baixo do botão. Recebe no email as instruções para criar uma nova. Se mesmo assim não conseguir, o rodapé da página tem os emails de apoio.</p>')}
${callout('info', 'Não consegue entrar?', '<p>Confirme que escreveu o email e a senha sem espaços a mais. Se continuar sem entrar, ligue ou escreva para o apoio indicado no fundo da página — é para isso que lá está.</p>')}
` },
    { titulo: 'O menu: onde fica cada coisa', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Assim que entra, chega ao <strong>Início</strong>. No topo, a toda a largura, está o <strong>menu</strong> — é por aqui que anda no portal. Cada palavra do menu leva a uma área:</p>
${fig('inicio.png', 'A página inicial. Em cima, o menu. No meio, a caixa de pesquisa. Em baixo, os documentos novos.')}
<p>As áreas dividem-se em duas partes:</p>
${tabela(['Parte do menu', 'Para quê', 'Quem vê'], [
  ['<strong>Consulta</strong> (Início, Biblioteca, Pesquisa, As minhas leituras, Aprovações)', 'Encontrar e ler documentos, confirmar leituras, assinar', 'Toda a gente com acesso'],
  ['<strong>Gestão</strong>', 'Carregar, aprovar, organizar pastas, conformidade…', 'Só quem tem perfil de gestão'],
])}
${callout('info', 'O menu adapta-se a si', '<p>Só vê o que o seu perfil lhe permite usar. Se é um leitor, não verá a parte de «Gestão» — e isso é de propósito, não é um erro nem falta nada.</p>')}
<p>No canto superior direito há um <strong>ponto de interrogação «?»</strong>. Carregue nele sempre que tiver dúvidas: abre o <strong>Guia do Utilizador</strong> e este curso.</p>
${fig('menu-ajuda.png', 'O menu de ajuda «?», no canto superior direito: o Guia do Utilizador e este curso.')}
` },
    { titulo: 'Vocabulário: as palavras que vai encontrar', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Seis palavras explicam quase tudo. Guarde-as:</p>
${acordeao([
  ['Em vigor', '<p>O estado de um documento que <strong>vale agora</strong>. É a versão que deve usar. Os outros estados — rascunho, em revisão, aprovado, obsoleto — não servem para trabalhar.</p>'],
  ['Revisão (versão)', '<p>Cada vez que um documento muda de forma significativa, nasce uma <strong>revisão nova</strong>. A anterior passa a obsoleta. O portal mostra sempre qual é a revisão em vigor e desde quando.</p>'],
  ['Emenda', '<p>Uma alteração a um documento já em vigor — tipicamente a troca de algumas páginas. Quem detém o documento tem de <strong>confirmar que recebeu a emenda</strong>, e há um prazo para isso.</p>'],
  ['Confirmação de leitura', '<p>Quando um documento lhe pede para confirmar que o leu, a sua confirmação é a <strong>prova de que o recebeu</strong>. A lei exige-a para certos documentos.</p>'],
  ['Cópia controlada', '<p>Nos documentos de segurança da aviação (AVSEC), cada cópia entregue é <strong>numerada e registada</strong>, e só pode ir para quem está autorizado (credenciado).</p>'],
  ['Pasta', '<p>A estrutura que organiza os documentos, normalmente por aeroporto e por manual. <strong>Quem não vê a pasta não vê o que está lá dentro</strong> — é assim que se controla o acesso.</p>'],
])}
${pergunta('Se tenho uma cópia impressa de um procedimento, posso usá-la?', 'Só para ler no momento. Antes de agir, confirme no portal que é a versão «Em vigor» — uma impressão envelhece sem avisar.')}
` },
    { titulo: 'Glossário em cartões (actividade)', tipo: 'html5', duracao_min: 6, conteudo_url: `${U}/h5p/ged-glossario/`, conclusao: 'manual', opcoes: { norma: 'h5p', main_library: 'H5P.Dialogcards' }, creditos: 'Actividade H5P (Dialog Cards) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — Encontrar e ler
const M2 = {
  titulo: 'Encontrar e ler um documento',
  descricao: 'A página inicial, a Biblioteca, a Pesquisa e o leitor.',
  aulas: [
    { titulo: 'A página inicial: o seu ponto de partida', tipo: 'texto', duracao_min: 5, creditos: CRED, conteudo_texto: `
<p>Quando entra, chega ao <strong>Início</strong>. Tem tudo o que precisa para começar:</p>
<ul>
<li>uma <strong>caixa de pesquisa</strong> — escreva aqui o que procura e vá direito ao resultado;</li>
<li><strong>Novos ou actualizados</strong> — os documentos que mudaram desde a sua última visita (marcados «Novo»);</li>
<li><strong>Falta confirmar</strong> — os documentos à espera da sua confirmação de leitura (só aparece se houver);</li>
<li><strong>os seus aeroportos</strong> — atalho às pastas de cada aeroporto a que tem acesso.</li>
</ul>
${callout('dica', 'Comece sempre pela pesquisa', '<p>Se sabe o que procura, escrever na caixa é mais rápido do que percorrer pastas.</p>')}
` },
    { titulo: 'A Biblioteca: tudo arrumado por aeroporto e pastas', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>A <strong>Biblioteca</strong> (carregue em «Biblioteca» no menu) mostra todos os documentos a que tem acesso, organizados tal como o manual está: por <strong>aeroporto</strong> e, dentro de cada um, por <strong>pastas</strong> (o Manual de Operações, os seus apêndices e anexos, os programas, etc.).</p>
${fig('biblioteca.png', 'A Biblioteca: à esquerda a lista de pastas; ao centro, as pastas grandes e a lista de documentos.')}
${passos([
  'À esquerda, escolha o aeroporto (ou «Todos deste aeroporto»).',
  'Carregue numa <strong>pasta</strong> (as caixas com o desenho de uma pasta) para ver o que está lá dentro.',
  'Carregue no nome de um <strong>documento</strong> para o abrir. Abre-se a versão «Em vigor» — a que deve usar.',
])}
${callout('info', 'Um documento pode aparecer em mais do que uma pasta', '<p>Um mapa pode pertencer ao Apêndice e ao Anexo ao mesmo tempo. É o mesmo documento, uma só versão, mostrado nos dois sítios — não são cópias diferentes.</p>')}
` },
    { titulo: 'A Pesquisa: por número, por título e por palavra', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>A <strong>Pesquisa</strong> (carregue em «Pesquisa» no menu) faz três coisas que valem ouro:</p>
${fig('pesquisa.png', 'A Pesquisa: escreva na caixa de cima o que procura. Bastam 2 letras.')}
${tabela(['Procura por…', 'Exemplo', 'Útil quando…'], [
  ['Número', 'POP-FNMO-MGSO-010', 'sabe a referência do documento'],
  ['Título ou palavra do título', 'Plano de Emergência', 'sabe mais ou menos como se chama'],
  ['Palavra <strong>dentro</strong> do texto', 'extintor, pista 05', 'sabe o assunto mas não o documento'],
])}
<p>A procura dentro do texto é a mais poderosa: diz-lhe <strong>em que página de que documento</strong> a palavra aparece. Clicando no resultado, o leitor abre <strong>directamente nessa página</strong>, com o termo realçado.</p>
<p>Pode ainda <strong>filtrar</strong> por manual, por classe de documento, por estado e por validade — é assim que um inspector procura: «mostrem-me tudo o que pertence ao Programa de Segurança».</p>
${pergunta('Quero saber onde o manual fala de "incursão em pista". Como faço?', 'Escreva "incursão em pista" na Pesquisa. O portal mostra as páginas onde a expressão aparece, em todos os documentos a que tem acesso, e leva-o directamente a cada uma.')}
` },
    { titulo: 'O leitor: navegar, saltar à página e ler sem rede', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Ao carregar no nome de um documento, ele abre-se. É assim que fica o ecrã:</p>
${fig('documento-aberto.png', 'Um documento aberto. Em cima: o nome, o estado («Em vigor»), e os botões. Ao centro: o documento, página a página. À direita: as versões, emendas e confirmações.')}
<p>Em cima tem os botões mais importantes: <strong>«Li e tomei conhecimento»</strong> (para confirmar a leitura), <strong>«Descarregar»</strong>, e <strong>«Partilhar com externo»</strong>. Por baixo, o documento, com uma barra para navegar:</p>
${fig('documento-indice.png', 'À esquerda, o índice e as páginas em miniatura — carregue numa secção ou numa miniatura para saltar lá. À direita, o separador «Acessos»: quem abriu o documento.')}
<p>Com essa barra consegue:</p>
<ul>
<li>abrir o <strong>índice</strong> (o primeiro botão à esquerda) e saltar para uma secção ou página;</li>
<li><strong>mudar de página</strong> com as setas, ou escrever o número da página na caixa;</li>
<li><strong>aumentar</strong> ou diminuir o tamanho (as lupas com + e −);</li>
<li><strong>procurar uma palavra</strong> dentro do documento aberto (a lupa);</li>
<li><strong>«Guardar para ler sem rede»</strong>: fica no seu computador para ler mesmo que a internet caia.</li>
</ul>
<p>E o <strong>estado e a revisão</strong> estão sempre à vista, no topo, para saber que está a ler a versão certa.</p>
${callout('aviso', 'A cópia offline pode envelhecer', '<p>A leitura sem rede guarda o documento no momento. Se o portal tiver uma revisão nova, o leitor avisa — não confie numa cópia offline antiga sem confirmar.</p>')}
` },
    { titulo: 'Verifique: encontrar e ler (actividade)', tipo: 'html5', duracao_min: 4, conteudo_url: `${U}/h5p/ged-quiz-encontrar/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.MultiChoice' }, creditos: 'Actividade H5P (Multiple Choice) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — Leituras e confirmações
const M3 = {
  titulo: 'As minhas leituras e as confirmações',
  descricao: 'Confirmar a leitura, e o regime de 30 dias das emendas.',
  aulas: [
    { titulo: 'Confirmar a leitura: o que é e porque importa', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Alguns documentos pedem-lhe para <strong>confirmar que os leu</strong>. Essa confirmação não é burocracia: é a <strong>prova</strong>, com o seu nome e a data, de que o documento lhe foi distribuído e você tomou conhecimento. A regulamentação aeronáutica exige esta prova para a distribuição electrónica de documentos controlados.</p>
<p>Carregue em <strong>«As minhas leituras»</strong> no menu. Vê duas listas: o que está <strong>por confirmar</strong> e o que já <strong>confirmou</strong>. Quando não tem nada pendente, aparece assim:</p>
${fig('leituras.png', 'As minhas leituras, sem nada pendente. Quando houver algo para confirmar, aparece aqui.')}
${passos([
  'Abra o documento que está por confirmar.',
  'Leia-o — a sério: a confirmação diz que o leu.',
  'Carregue no botão azul <strong>«Li e tomei conhecimento»</strong>, no topo do documento.',
])}
<p>Mal confirme, o botão azul desaparece e no lugar fica, a verde, <strong>«Leitura confirmada em…»</strong> com a data e a versão. É a sua prova, e já não precisa de fazer mais nada:</p>
${fig('leitura-confirmada.png', 'Depois de confirmar: onde estava o botão azul fica, a verde, «Leitura confirmada em 03/10/2026 · v1».')}
${callout('info', 'A confirmação é por revisão', '<p>Se o documento tiver uma revisão nova, é-lhe pedido para confirmar outra vez. Faz sentido: mudou o conteúdo, tem de tomar conhecimento do novo.</p>')}
` },
    { titulo: 'Emendas e o prazo de 30 dias', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Uma <strong>emenda</strong> é uma alteração a um documento já em vigor. Quando recebe uma, o relógio começa a contar: tem <strong>30 dias</strong> para confirmar que a recebeu. É o prazo que a regulamentação fixa.</p>
${callout('aviso', 'O que acontece se não confirmar a tempo', '<p>Recebe lembretes antes do prazo. Se o prazo passar sem a sua confirmação, o <strong>director do seu aeroporto é avisado</strong> — uma confirmação em falta é um achado numa inspecção, não um detalhe administrativo.</p>')}
<p>Não deixe acumular. Confirmar leva segundos; explicar a uma inspecção porque é que vinte pessoas não confirmaram uma emenda leva muito mais.</p>
${pergunta('Recebi uma emenda mas estou de férias duas semanas. Perco o prazo?', 'Tem 30 dias, por isso há folga. Mas assim que puder, confirme — e se prevê uma ausência longa, avise o gestor de documentos do seu aeroporto.')}
` },
    { titulo: 'Complete as regras que evitam enganos (actividade)', tipo: 'html5', duracao_min: 4, conteudo_url: `${U}/h5p/ged-lacunas/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.Blanks' }, creditos: 'Actividade H5P (Fill in the Blanks) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — Aprovações
const M4 = {
  titulo: 'Aprovar documentos (revisores e directores)',
  descricao: 'O percurso de aprovação e como assinar ou devolver.',
  aulas: [
    { titulo: 'O percurso de aprovação, do início ao fim', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Um documento novo ou uma revisão não entram em vigor por magia. Seguem um percurso com responsáveis claros:</p>
${passos([
  '<strong>O elaborador</strong> carrega o documento (o PDF e o ficheiro editável) e envia-o para revisão.',
  '<strong>O revisor</strong> analisa e assina — ou devolve, com um motivo.',
  '<strong>O director</strong> aprova e assina — e só então o documento pode entrar em vigor.',
])}
${callout('info', 'Porque é que cada passo assina', '<p>Cada assinatura fica registada com quem a fez e quando, de forma que não se pode forjar nem apagar. É o que dá valor legal à aprovação: numa inspecção, prova-se quem aprovou o quê.</p>')}
` },
    { titulo: 'Assinar e devolver, no separador Aprovações', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Carregue em <strong>«Aprovações»</strong> no menu — é a sua caixa de entrada. Quando há um documento à sua espera, aparece aqui; quando não há, diz «Não tem nada à espera de si»:</p>
${fig('aprovacoes.png', 'As Aprovações. Quando um documento precisar da sua revisão ou aprovação, aparece nesta lista.')}
<p>Ao abrir um documento que espera a sua assinatura, vê o documento, a versão, quem já assinou antes de si, e dois botões:</p>
${tabela(['Acção', 'Quando usar', 'O que acontece'], [
  ['<strong>Assinar</strong>', 'O documento está bom para avançar', 'Pede a sua senha; a assinatura fica registada e o documento segue para o passo seguinte'],
  ['<strong>Devolver</strong>', 'Há algo a corrigir', 'Pede o motivo e devolve ao elaborador, que corrige e reenvia'],
])}
${callout('aviso', 'Assinar é um acto seu', '<p>Pede-se a sua senha de propósito: a assinatura é sua e fica registada em seu nome. Não a partilhe com ninguém para «despachar» uma aprovação — está a assinar com a sua responsabilidade.</p>')}
${pergunta('Sou director mas só tenho perfil de leitor. Consigo assinar?', 'Sim. As Aprovações aparecem a quem tem de assinar, mesmo que só consulte documentos no resto do portal. O que espera a sua assinatura aparece-lhe lá.')}
` },
    { titulo: 'Quem faz o quê na aprovação (actividade de arrastar)', tipo: 'html5', duracao_min: 5, conteudo_url: `${U}/h5p/ged-arrastar-fluxo/`, conclusao: 'automatica', opcoes: { norma: 'h5p', main_library: 'H5P.DragQuestion' }, creditos: 'Actividade H5P (Drag and Drop) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — Gerir o acervo (gestão)
const M5 = {
  titulo: 'Gerir o acervo (para gestores)',
  descricao: 'Carregar e publicar, organizar pastas e acessos, registar emendas.',
  aulas: [
    { titulo: 'Carregar, editar e publicar: os estados do documento', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Carregue em <strong>Gestão</strong> (no menu) e depois em <strong>Documentos</strong>. É aqui que o documento nasce e muda de estado. Os estados são um percurso, não etiquetas soltas:</p>
${fig('menu-gestao.png', 'O menu «Gestão» aberto: todas as áreas de quem gere documentos.')}
${fig('gestao-documentos.png', 'Gestão › Documentos: filtros em cima, botão «Novo documento», e a lista de documentos em baixo.')}
${tabela(['Estado', 'Significa'], [
  ['Rascunho', 'A ser preparado; só quem edita o vê'],
  ['Em revisão', 'Enviado para o revisor assinar'],
  ['Aprovado', 'Assinado pelo director, à espera de entrar em vigor'],
  ['Em vigor', 'A versão válida, visível a quem tem acesso'],
  ['Obsoleto', 'Substituído por uma revisão mais recente'],
])}
${callout('dica', 'O número é sugerido', '<p>Ao carregar, escolha a classe, o aeroporto e o manual: o sistema <strong>sugere o número seguinte</strong> e avisa se o número que escreveu foge à codificação. Sugere e valida — não impõe, porque há documentos antigos fora do padrão.</p>')}
${callout('info', 'Data de entrada em vigor agendada', '<p>Pode marcar a data em que uma revisão entra em vigor. Na data marcada, a revisão nova entra sozinha e a anterior passa a obsoleta — sem ninguém ter de clicar.</p>')}
` },
    { titulo: 'Pastas e acessos: quem vê o quê', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>O acesso decide-se na <strong>estrutura de pastas</strong> (Gestão › Pastas) e nos <strong>Acessos</strong>.</p>
${fig('gestao-pastas.png', 'Gestão › Pastas: a árvore de pastas à esquerda; escolhe-se uma para acertar as permissões.')}
<ul>
<li>uma pasta pode ter <strong>senha</strong> e restringir-se a <strong>perfis</strong>;</li>
<li><strong>quem não vê a pasta não vê os documentos lá dentro</strong> — é a regra base de todo o controlo de acesso do portal;</li>
<li>em <strong>Acessos</strong> convidam-se pessoas, tratam-se pedidos e definem-se perfis.</li>
</ul>
${callout('aviso', 'O acesso é decidido no servidor', '<p>Não é o ecrã que esconde documentos — é o servidor que só entrega a cada pessoa o que ela pode ver. Isso vale para a Biblioteca, para a Pesquisa, para os links e para os downloads.</p>')}
` },
    { titulo: 'Emendas e folhas de controlo', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Em <strong>Gestão › Emendas</strong> regista-se cada emenda no formato que a regulamentação exige (o Anexo 3: número, data, páginas afectadas, resumo, quem aprovou…), geram-se as <strong>folhas de controlo</strong> e acompanham-se as <strong>confirmações de recebimento</strong>.</p>
${fig('gestao-emendas.png', 'Gestão › Emendas: em cima, a diferença entre emenda e corrigenda; o botão «Nova emenda» abre o registo.')}
${callout('info', 'Emenda vs corrigenda', '<p>Uma <strong>emenda</strong> altera conteúdo e precisa de passar pela aprovação (e, no caso dos documentos sujeitos à ANAC, pela ANAC). Uma <strong>corrigenda</strong> corrige apenas gralhas e entra sem aprovação prévia. O portal trata as duas de forma diferente, de propósito.</p>')}
<p>O prazo de 30 dias que o colaborador vê do seu lado é gerido aqui: quem gere vê <strong>quem já confirmou e quem falta</strong>, e o que passou do prazo é escalado ao director do aeroporto.</p>
` },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — Conformidade e regimes (gestão)
const M6 = {
  titulo: 'Codificação, conformidade e regimes (para gestores)',
  descricao: 'A codificação do número, a matriz de conformidade, o regime AVSEC, links, auditoria e relatórios.',
  aulas: [
    { titulo: 'A codificação: o número do documento conta uma história', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>O número de um documento não é arbitrário. <strong>POP-FNMO-MGSO-010</strong> diz quatro coisas:</p>
${fig('gestao-codificacao.png', 'Gestão › Codificação: o número desmontado em cima (classe · aeroporto · processo · sequência).')}
${tabela(['Parte', 'Exemplo', 'Significa'], [
  ['Classe', 'POP', 'o que o documento é (Procedimento Operacional Padrão)'],
  ['Aeroporto', 'FNMO', 'a que aeroporto pertence (Namibe)'],
  ['Processo', 'MGSO', 'de que manual ou programa faz parte (SGSO)'],
  ['Número', '010', 'o número sequencial dentro desse processo'],
])}
<p>Em <strong>Gestão › Codificação</strong> gerem-se as classes e os processos (os manuais e programas). Isto permite percorrer a biblioteca «por manual» e tirar o registo de emendas por manual, que é como a lei organiza.</p>
` },
    { titulo: 'Conformidade: responder à ANAC por requisito', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Uma inspecção da ANAC não pergunta «mostrem-me os documentos». Pergunta «<strong>onde, no vosso Manual de Operações, está o que cumpre este parágrafo da lei?</strong>».</p>
<p>A <strong>matriz de conformidade</strong> (Gestão › Conformidade) responde a isso: liga cada <strong>requisito</strong> (diploma, artigo, texto) ao <strong>documento, revisão e página</strong> que o cumpre — e mostra os <strong>buracos</strong>, os requisitos que ainda não têm nada a apontar.</p>
${callout('info', 'É uma vantagem rara', '<p>Poucos sistemas no mundo fazem isto, e nenhum conhece a lei angolana. É um dos trunfos do portal numa inspecção — mas só vale se alguém mantiver a matriz preenchida e verificada.</p>')}
` },
    { titulo: 'Regime AVSEC: os documentos de segurança da aviação', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Os documentos do Programa de Segurança do Aeroporto (PSA/AVSEC) têm um regime próprio, mais apertado, porque a lei os trata como <strong>matéria classificada</strong>. Em <strong>Gestão › Regime AVSEC</strong> encontra:</p>
${fig('gestao-avsec.png', 'Gestão › Regime AVSEC: visão geral com os documentos no regime, cópias controladas e conferências.')}
${acordeao([
  ['Lista de Páginas Efectivas (LPE)', '<p>Por documento e revisão, cada página com a sua revisão e data. É o que permite a um detentor provar que a sua cópia está completa e actual.</p>'],
  ['Cópias controladas', '<p>Cada cópia entregue é numerada e registada. Uma cópia classificada <strong>só se entrega a quem tem credencial válida</strong> — o portal recusa entregá-la a quem não está credenciado.</p>'],
  ['Conferência semestral', '<p>De seis em seis meses confere-se que nenhuma página foi retirada, inserida, modificada ou alterada à mão. Fica o registo de quem conferiu e quando.</p>'],
  ['Credenciados', '<p>O registo de quem está autorizado a deter documentos classificados, com a validade da credenciação.</p>'],
])}
${callout('aviso', 'Este regime é por lei, não por opção', '<p>A numeração das cópias, a conferência semestral e a credenciação vêm dos Instrutivos da ANAC. Não são boas práticas opcionais — são exigências.</p>')}
` },
    { titulo: 'Links, auditoria e relatórios', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Três áreas que fecham o ciclo:</p>
${fig('gestao-links.png', 'Gestão › Links: os endereços partilháveis com externos (ANAC, auditores), com validade e estado.')}
${tabela(['Área', 'Para quê'], [
  ['<strong>Links</strong>', 'Partilhar um documento ou uma pasta com alguém de fora (um auditor, a ANAC). O link é <strong>temporário</strong>, pode ter senha, e é de <strong>leitura</strong>: a pessoa vê, não altera nem navega no resto. Um documento retirado deixa de sair pelo link.'],
  ['<strong>Auditoria</strong>', 'Quem viu, quem descarregou e quem alterou cada documento. O registo <strong>não se pode apagar nem mudar</strong> — é a prova, numa inspecção, de que o controlo é real.'],
  ['<strong>Relatórios</strong>', 'Leitura, validade e cobertura por aeroporto, para acompanhar à distância sem abrir documento a documento.'],
])}
${callout('info', 'O rasto é inviolável de propósito', '<p>Mesmo um administrador não pode reescrever o registo de auditoria. É essa impossibilidade que lhe dá valor: o que lá está, aconteceu.</p>')}
` },
    { titulo: 'Perguntas frequentes (actividade)', tipo: 'html5', duracao_min: 5, conteudo_url: `${U}/h5p/ged-faq/`, conclusao: 'manual', opcoes: { norma: 'h5p', main_library: 'H5P.Accordion' }, creditos: 'Actividade H5P (Accordion) produzida internamente. Bibliotecas H5P: H5P Group, licença MIT.' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Banco de perguntas, com categoria: 'Consulta' (todos), 'Aprovar' (revisores/directores), 'Gestão' (gestores).
// Cada curso usa as da sua categoria na sua avaliação final.
const PERGUNTAS = [
  { categoria: 'Consulta', tipo: 'escolha_unica', enunciado: 'Qual é a versão de um documento que deve usar para trabalhar?', opcoes: op([['A mais recente que tenho no computador', false], ['A que está «Em vigor» no portal', true], ['A que está «Aprovado»', false], ['Qualquer uma, desde que tenha o mesmo número', false]]), explicacao: 'Só a versão «Em vigor» é a válida. As outras são rascunho, aprovação pendente ou história.' },
  { categoria: 'Consulta', tipo: 'vf', enunciado: 'Uma cópia impressa de um procedimento pode ser usada para agir sem confirmar nada no portal.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'Uma impressão envelhece sem avisar. Antes de agir, confirme no portal que é a versão «Em vigor».' },
  { categoria: 'Consulta', tipo: 'escolha_unica', enunciado: 'Quero saber em que página o manual fala de "incursão em pista". Qual é a forma mais rápida?', opcoes: op([['Percorrer todas as pastas da Biblioteca', false], ['Escrever "incursão em pista" na Pesquisa (procura dentro do texto)', true], ['Pedir ao gestor por email', false], ['Descarregar todos os documentos e procurar no computador', false]]), explicacao: 'A pesquisa por conteúdo diz em que página de que documento a expressão aparece, e leva-o lá directamente.' },
  { categoria: 'Consulta', tipo: 'escolha_multipla', enunciado: 'O que é verdade sobre a confirmação de leitura?', opcoes: op([['É a prova de que recebeu e leu o documento', true], ['A lei exige-a para certos documentos', true], ['É pedida de novo quando há uma revisão nova', true], ['Serve para ganhar pontos no portal', false]]), explicacao: 'É prova legal de recebimento, por revisão; nada tem a ver com pontos.' },
  { categoria: 'Consulta', tipo: 'numerica', enunciado: 'Quantos dias tem para confirmar o recebimento de uma emenda? (número)', opcoes: [{ valor: 30, tolerancia: 0 }], explicacao: 'São 30 dias, fixados pela regulamentação. Passado o prazo, o director do aeroporto é avisado.' },
  { categoria: 'Consulta', tipo: 'vf', enunciado: 'Se não confirmar uma emenda dentro do prazo, ninguém dá por isso.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'Recebe lembretes e, passado o prazo, o director do seu aeroporto é avisado.' },
  { categoria: 'Aprovar', tipo: 'ordenacao', enunciado: 'Coloque pela ordem correcta o percurso de aprovação de um documento.', opcoes: [{ id: 'a', texto: 'O elaborador carrega o documento' }, { id: 'b', texto: 'O revisor assina' }, { id: 'c', texto: 'O director aprova e assina' }, { id: 'd', texto: 'O documento entra em vigor' }], explicacao: 'Elaborador → revisor → director → em vigor. Cada passo assina, e a assinatura fica registada.' },
  { categoria: 'Aprovar', tipo: 'escolha_unica', enunciado: 'Pedem-lhe a senha para assinar uma aprovação. Porquê?', opcoes: op([['Para confirmar que não é um robô', false], ['Porque a assinatura é sua e fica registada em seu nome', true], ['Para desbloquear o documento', false], ['É um passo opcional', false]]), explicacao: 'A assinatura é um acto seu, com a sua responsabilidade — por isso não se partilha a senha para «despachar».' },
  { categoria: 'Aprovar', tipo: 'vf', enunciado: 'Quando devolve um documento ao elaborador, deve escrever o motivo.', opcoes: op([['Verdadeiro', true], ['Falso', false]]), explicacao: 'O motivo diz ao elaborador o que corrigir — devolver sem motivo faz o documento andar em círculos.' },
  { categoria: 'Aprovar', tipo: 'escolha_unica', enunciado: 'Onde aparecem os documentos que esperam a sua assinatura?', opcoes: op([['Na Biblioteca', false], ['No separador «Aprovações»', true], ['Em «As minhas leituras»', false], ['Só por email', false]]), explicacao: '«Aprovações» é a sua caixa de entrada; também recebe um email a avisar.' },
  { categoria: 'Consulta', tipo: 'lacuna', enunciado: 'Um documento que a pessoa marque para ler sem internet fica disponível ________, com aviso se houver revisão mais recente.', opcoes: [{ id: 'a', texto: 'offline' }, { id: 'b', texto: 'sem rede' }, { id: 'c', texto: 'desligado' }], explicacao: 'A leitura offline guarda o documento no momento; o leitor avisa se o portal tiver uma revisão nova.' },
  { categoria: 'Gestão', tipo: 'escolha_unica', enunciado: 'No número POP-FNMO-MGSO-010, o que indica o "MGSO"?', opcoes: op([['A classe (o que o documento é)', false], ['O aeroporto', false], ['O processo — o manual ou programa a que pertence', true], ['O número sequencial', false]]), explicacao: 'Classe-Aeroporto-Processo-Número: MGSO é o processo (o Manual de Gestão da Segurança Operacional).' },
  { categoria: 'Gestão', tipo: 'correspondencia', enunciado: 'Ligue cada estado do documento ao seu significado.', opcoes: [{ id: 'a', esquerda: 'Em vigor', direita: 'A versão válida, visível a quem tem acesso' }, { id: 'b', esquerda: 'Rascunho', direita: 'A ser preparado; só quem edita o vê' }, { id: 'c', esquerda: 'Obsoleto', direita: 'Substituído por uma revisão mais recente' }, { id: 'd', esquerda: 'Aprovado', direita: 'Assinado, à espera de entrar em vigor' }], explicacao: 'Os estados são um percurso: rascunho → em revisão → aprovado → em vigor → (obsoleto).' },
  { categoria: 'Gestão', tipo: 'vf', enunciado: 'Uma cópia controlada de um documento AVSEC pode ser entregue a qualquer colaborador que a peça.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'Só a quem tem credencial válida. O portal recusa entregar uma cópia classificada a quem não está credenciado.' },
  { categoria: 'Gestão', tipo: 'escolha_multipla', enunciado: 'O que distingue uma emenda de uma corrigenda?', opcoes: op([['A emenda altera conteúdo e precisa de aprovação', true], ['A corrigenda corrige apenas gralhas e entra sem aprovação prévia', true], ['São exactamente a mesma coisa', false], ['A corrigenda precisa sempre da ANAC', false]]), explicacao: 'O portal trata as duas de forma diferente, de propósito: a corrigenda não exige aprovação prévia.' },
  { categoria: 'Gestão', tipo: 'escolha_unica', enunciado: 'Porque é que o registo de auditoria não se pode apagar nem alterar, nem por um administrador?', opcoes: op([['Para poupar espaço em disco', false], ['Porque é essa impossibilidade que lhe dá valor como prova', true], ['Por limitação técnica da base de dados', false], ['Para a página abrir mais depressa', false]]), explicacao: 'Um registo que se pudesse reescrever não provava nada. Ser inviolável é precisamente o que o torna prova.' },
  { categoria: 'Gestão', tipo: 'aberta', enunciado: 'Em duas ou três frases: um gestor quer apagar de vez um documento antigo "para limpar". Que cuidados lhe apontaria?', opcoes: [{ max_chars: 600, rubrica: 'Não apagar de vez: perde-se a história e as confirmações de leitura (prova exigida). Retirar faz-se em modo suave (deleted_at), que o tira da biblioteca mas preserva o rasto. A retenção/eliminação definitiva é um processo autorizado, com registo, não um clique.' }], pontos: 2, explicacao: 'O apagar definitivo arrastaria a auditoria e as confirmações; retira-se em modo suave e a eliminação é um processo controlado.' },
];

// quiz comum: só muda o título e as perguntas (filtradas por categoria)
const quiz = (titulo, aprovadoMsg) => ({
  titulo, ativo: true, ordem: 1, nota_minima: 70, tentativas_max: 3, tempo_limite_min: 20,
  baralhar_perguntas: true, baralhar_opcoes: true, rever_apos: true, gera_certificado: true, requer_aulas_concluidas: true, modo_sem_consulta: false,
  feedback_faixas: [
    { min: 0, max: 69, mensagem: 'Reveja as aulas assinaladas na revisão e tente de novo — tem 3 tentativas.' },
    { min: 70, max: 89, mensagem: aprovadoMsg },
    { min: 90, max: 100, mensagem: 'Excelente!' },
  ],
});
const porCat = (c) => PERGUNTAS.filter(p => p.categoria === c);

// ═══════════════════════════════════════════════════════════════════════════
// TRÊS CURSOS, por perfil — cada um reaproveita os módulos e os H5P já criados.
export const CURSOS = [
  {
    curso: { ...BASE, ordem: 1, titulo: 'GED — Consultar documentos',
      capa_url: `${U}/capas/ged-consultar.svg`,
      descricao: `Para TODOS os colaboradores com acesso ao portal. Do zero: o que é o Portal de Documentos, como entrar, encontrar e ler um documento, e como confirmar a leitura quando lhe é pedido. Com capturas de ecrã reais e actividades interactivas. No fim, uma avaliação e o certificado.` },
    modulos: [M1, M2, M3],
    perguntas: porCat('Consulta'),
    quiz: quiz('Avaliação — Consultar documentos', 'Aprovado! Já sabe consultar o portal.'),
  },
  {
    curso: { ...BASE, ordem: 2, titulo: 'GED — Aprovar documentos',
      capa_url: `${U}/capas/ged-aprovar.svg`,
      descricao: `Para REVISORES e DIRECTORES. O percurso de aprovação de um documento — do elaborador ao director —, como assinar com a sua senha e como devolver com um motivo. Com a actividade de arrastar «quem faz o quê». Pressupõe o curso «Consultar documentos».` },
    modulos: [M4],
    perguntas: porCat('Aprovar'),
    quiz: quiz('Avaliação — Aprovar documentos', 'Aprovado! Já sabe rever e aprovar.'),
  },
  {
    curso: { ...BASE, ordem: 3, titulo: 'GED — Gerir documentos',
      capa_url: `${U}/capas/ged-gerir.svg`,
      descricao: `Para GESTORES de documentos. Carregar, editar e publicar; organizar pastas e acessos; registar emendas; a codificação do número; a conformidade com a ANAC; o regime próprio dos documentos de segurança (AVSEC); links, auditoria e relatórios. Pressupõe os cursos anteriores.` },
    modulos: [M5, M6],
    perguntas: porCat('Gestão'),
    quiz: quiz('Avaliação — Gerir documentos', 'Aprovado! Já sabe gerir o acervo.'),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TRILHAS por função — encadeiam os cursos num caminho só (a fluidez pedida).
export const TRILHAS = [
  { titulo: 'GED — Leitor', descricao: 'Para quem só consulta documentos.', sequencial: true, cursos: ['GED — Consultar documentos'] },
  { titulo: 'GED — Revisor e Director', descricao: 'Consulta e aprovação de documentos.', sequencial: true, cursos: ['GED — Consultar documentos', 'GED — Aprovar documentos'] },
  { titulo: 'GED — Gestor documental', descricao: 'O percurso completo: consultar, aprovar e gerir.', sequencial: true, cursos: ['GED — Consultar documentos', 'GED — Aprovar documentos', 'GED — Gerir documentos'] },
];

// o curso único antigo, a retirar no seed (foi dividido nos três acima)
export const CURSO_ANTIGO_TITULO = 'Como usar o Portal de Documentos (GED)';
