// Conteúdo dos cursos AVSEC da Universidade Corporativa (pt-PT):
//   A) "Segurança da Aviação Civil (AVSEC) — Formação Inicial"  (domínio; base PFTSAC + NTA 32 + ICAO Anexo 17/Doc 8973 + app de risco SGA)
//   B) "AVSEC no Portal de Documentos (GED)"  (como os documentos AVSEC vivem no portal: classificação, cópias controladas, credenciais, descarga protegida)
// Molde: tools/curso-ged/conteudo.mjs. Conteúdo produzido internamente — A SER VALIDADO pelo responsável AVSEC antes de uso formal.
const callout = (estilo, titulo, html) => `<div class="callout callout-${estilo}"><div class="callout-corpo"><p class="callout-titulo">${titulo}</p>${html}</div></div>`;
const acordeao = (itens) => itens.map(([t, h]) => `<details class="acordeao"><summary>${t}</summary>${h}</details>`).join('');
const pergunta = (p, r) => `<details class="pergunta-inline"><summary>${p}</summary><p><strong>Resposta:</strong> ${r}</p></details>`;
const passos = (itens) => `<ol class="passos">${itens.map(i => `<li>${i}</li>`).join('')}</ol>`;
const tabela = (cab, linhas) => `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const op = (arr) => arr.map(([texto, correta], i) => ({ id: String.fromCharCode(97 + i), texto, correta }));
const CRED = 'Conteúdo produzido internamente pela Direcção de Operações — SGA (Outubro 2026). A validar pelo responsável AVSEC.';
const U = '/storage/v1/object/public/uploads';
// figura com legenda; `nome` é o ficheiro em uploads/avsec-curso/ (imagens de domínio público — ver CREDITOS.txt)
const fig = (nome, legenda) => `<figure><img src="${U}/avsec-curso/${nome}" alt="${legenda}" /><figcaption>${legenda}</figcaption></figure>`;

const BASE = { categoria: 'Segurança da Aviação (AVSEC)', nivel: 'intermedio', publicado: true, obrigatorio_todos: false, obrigatorio_perfis: [] };

// Glossário NTA 32 (fonte: app de avaliação de risco AVSEC da SGA)
const GLOSSARIO = [
  ['ANAC', 'Autoridade Nacional da Aviação Civil (Angola). Reguladora e validadora.'],
  ['Anexo 17', 'Anexo 17 da Convenção de Chicago (ICAO) — segurança da aviação civil contra actos de interferência ilícita.'],
  ['AVSEC', 'Aviation Security — segurança da aviação civil contra actos de interferência ilícita.'],
  ['ARS', 'Área Restrita de Segurança — zona do lado ar com acesso controlado (NTA 32).'],
  ['Lado ar', 'Áreas com acesso ao movimento de aeronaves; sujeitas a controlo AVSEC.'],
  ['Lado terra', 'Áreas de acesso público (chegadas, partidas públicas, estacionamento, vias).'],
  ['Doc 8973', 'ICAO Doc 8973 — "Aviation Security Manual" (manual restrito da ICAO).'],
  ['NTA 32', 'Norma Técnica Aeronáutica 32 da ANAC Angola — regulamenta a segurança da aviação civil.'],
  ['NTA 40 / PNCQSAC', 'Programa Nacional de Controlo de Qualidade da Segurança da Aviação Civil; define categorias I–IV de aeródromos (§40.011).'],
  ['PNSAC', 'Programa Nacional de Segurança da Aviação Civil — planeamento AVSEC do Estado.'],
  ['PSA', 'Programa de Segurança do Aeroporto — como cada aeroporto cumpre o PNSAC.'],
  ['CASEAC', 'Comissão Aeroportuária de Segurança da Aviação Civil — coordenação local AVSEC.'],
  ['DEI', 'Dispositivo Explosivo Improvisado (IED em inglês).'],
  ['QBRN', 'Ameaça Química, Biológica, Radiológica ou Nuclear.'],
  ['MANPAD', 'Míssil terra-ar portátil; ameaça à aproximação/descolagem.'],
  ['RX', 'Inspecção por raios-X (bagagem de cabina, carga, encomendas).'],
  ['EDS', 'Explosives Detection System — detecção automática de explosivos na bagagem.'],
  ['WTMD', 'Pórtico detector de metais (Walk-Through Metal Detector).'],
  ['CCTV', 'Circuito fechado de televisão (videovigilância).'],
  ['Ronda', 'Patrulha em trajecto e horário aleatórios, para dissuasão e detecção.'],
  ['Vulnerabilidade', 'Grau em que uma medida falha em mitigar a ameaça (Alta = sem mitigação eficaz; Baixa = mitigação adequada).'],
];
const glossarioHtml = acordeao(GLOSSARIO.map(([t, d]) => [`<strong>${t}</strong>`, `<p>${d}</p>`]));

// ════════════════════════════════ CURSO A — AVSEC Formação Inicial ════════════════════════════════
const A_M1 = {
  titulo: 'Fundamentos da Segurança da Aviação (AVSEC)',
  descricao: 'O que é AVSEC, o que são actos de interferência ilícita e o quadro legal que nos obriga.',
  aulas: [
    { titulo: 'O que é AVSEC e o que protege', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>A <strong>Segurança da Aviação Civil (AVSEC</strong>, de <em>Aviation Security</em>) é o conjunto de medidas e recursos humanos e materiais que protegem a aviação civil contra <strong>actos de interferência ilícita</strong> — isto é, actos contra a segurança de pessoas e bens, como:</p>
<ul>
<li>apoderamento ilícito de aeronaves (desvio/sequestro);</li>
<li>destruição de uma aeronave em serviço; colocação de engenhos explosivos;</li>
<li>ataques a instalações aeroportuárias ou de navegação aérea;</li>
<li>introdução de armas, explosivos ou artigos perigosos a bordo ou em zona restrita.</li>
</ul>
${fig('checkpoint.jpg', 'Ponto de rastreio de passageiros num aeroporto — o controlo mais visível da segurança da aviação.')}
${callout('info', 'AVSEC não é SMS (Safety)', '<p>Não confunda <strong>Security (AVSEC)</strong> — protecção contra actos <em>intencionais</em>, malévolos — com <strong>Safety (SMS / SGSO)</strong> — prevenção de acidentes <em>não intencionais</em>. São áreas distintas, com documentos e responsáveis próprios.</p>')}
<p>O princípio orientador é o <strong>«need-to-know»</strong> (necessidade de conhecer): a informação e os documentos de segurança só chegam a quem precisa deles para a sua função. Guardar bem a informação É uma medida de segurança.</p>
` },
    { titulo: 'O quadro legal: de ICAO à SGA', tipo: 'texto', duracao_min: 9, creditos: CRED, conteudo_texto: `
<p>A segurança da aviação está regulada em camadas, da mais geral à mais local:</p>
${tabela(['Nível', 'Instrumento', 'O que fixa'], [
  ['Internacional', 'ICAO — <strong>Anexo 17</strong> e <strong>Doc 8973</strong>', 'Normas e práticas recomendadas; o manual de segurança da aviação.'],
  ['Nacional (Angola)', '<strong>NTA 32</strong> (ANAC) e <strong>PNSAC</strong>', 'Regras nacionais de AVSEC e o programa nacional de segurança.'],
  ['Controlo de qualidade', '<strong>NTA 40 / PNCQSAC</strong>', 'Auditorias, inspecções e testes; categorias I–IV de aeródromos.'],
  ['Aeroporto', '<strong>PSA</strong> — Programa de Segurança do Aeroporto', 'Como ESTE aeroporto cumpre tudo o acima. É o documento-mãe AVSEC local.'],
  ['Coordenação local', '<strong>CASEAC</strong>', 'Comissão que articula os intervenientes de segurança no aeroporto.'],
])}
${callout('aviso', 'Documentos classificados', '<p>Muitos destes documentos são <strong>matéria classificada</strong>: só se distribuem a pessoas <strong>credenciadas</strong>, em cópia controlada. É por isso que o acesso a eles no portal exige credencial — e é o que este curso lhe vai permitir obter.</p>')}
${pergunta('Qual é o documento AVSEC «mãe» de um aeroporto?', 'O PSA — Programa de Segurança do Aeroporto. Descreve como o aeroporto cumpre o PNSAC e a NTA 32.')}
` },
  ],
};
const A_M2 = {
  titulo: 'Zonas de segurança e controlo de acessos',
  descricao: 'Lado ar e lado terra, áreas restritas, credenciais e controlo de viaturas.',
  aulas: [
    { titulo: 'Lado ar, lado terra e Área Restrita de Segurança', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>O aeroporto divide-se, do ponto de vista da segurança, em zonas com regras diferentes:</p>
${tabela(['Zona', 'O que é', 'Regra de acesso'], [
  ['<strong>Lado terra</strong>', 'Acesso público: átrios de partidas/chegadas, estacionamento, vias.', 'Livre, com vigilância.'],
  ['<strong>Lado ar</strong>', 'Áreas com acesso ao movimento de aeronaves.', 'Controlado — só pessoas e viaturas autorizadas.'],
  ['<strong>Área Restrita de Segurança (ARS)</strong>', 'Parte do lado ar onde se aplicam medidas de segurança adicionais (ex.: junto a aeronaves, triagem de bagagem).', 'Credencial válida + necessidade operacional; sujeito a rastreio.'],
])}
${callout('dica', 'Uma credencial não é um passe livre', '<p>A credencial autoriza o acesso <strong>à zona e pelo tempo</strong> para que foi emitida. Entrar numa ARS para a qual não está autorizado é uma violação, mesmo que tenha credencial para outra zona.</p>')}
` },
    { titulo: 'Credenciamento e controlo de viaturas', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>O <strong>credenciamento</strong> é o processo que autoriza uma pessoa (ou viatura) a aceder a zonas controladas. Assenta em três ideias:</p>
${passos([
  '<strong>Necessidade de conhecer / de aceder</strong>: só se credencia quem precisa, para a função que tem.',
  '<strong>Verificação de antecedentes</strong> e autorização por quem de direito.',
  '<strong>Validade e revogação</strong>: a credencial tem prazo; termina por caducidade ou por revogação (com data e motivo), nunca «desaparece» sem rasto.',
])}
<p>As viaturas que entram no lado ar são também autorizadas, identificadas e, quando aplicável, inspeccionadas. Há registos próprios para isto (controlo de acesso de veículos, autorização de viaturas).</p>
${callout('info', 'Tudo isto deixa rasto', '<p>Entradas, inspecções e testes registam-se. Numa auditoria, «fez-se» não chega — tem de haver <strong>registo de que se fez</strong>, com data e responsável.</p>')}
` },
  ],
};
const A_M3 = {
  titulo: 'Rastreio e inspecção de segurança',
  descricao: 'Passageiros, bagagem, carga — equipamentos, procedimentos e artigos proibidos.',
  aulas: [
    { titulo: 'Como se rastreia e com que equipamentos', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>O <strong>rastreio</strong> procura detectar armas, explosivos e outros artigos proibidos antes de entrarem na zona restrita ou a bordo. Os meios típicos:</p>
${tabela(['Meio', 'Para quê'], [
  ['<strong>WTMD</strong> (pórtico detector de metais)', 'Rastreio de pessoas — detecta metais na passagem.'],
  ['Detector manual de metais', 'Rastreio complementar e localização do metal detectado.'],
  ['<strong>RX</strong> (raios-X)', 'Bagagem de cabina, carga e encomendas — imagem do conteúdo.'],
  ['<strong>EDS</strong>', 'Detecção automática de explosivos na bagagem de porão.'],
  ['Revista física', 'Quando os meios acima assinalam, ou por amostragem aleatória.'],
])}
${fig('raio-x-bagagem.jpg', 'Inspecção de bagagem por raios-X (RX): a imagem revela o conteúdo sem abrir a mala.')}
${fig('rastreio.jpg', 'Rastreio de bagagem à entrada de um aeroporto — todos passam pelo mesmo controlo.')}
${callout('aviso', 'O equipamento só vale se funcionar e for testado', '<p>Pórticos e RX têm de ser <strong>testados e calibrados</strong> com registo. Um equipamento sem teste válido é como não ter equipamento — e uma inspecção vê isso no primeiro minuto.</p>')}
` },
    { titulo: 'Artigos proibidos e o que fazer', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Artigos proibidos são os que não podem seguir (ou que exigem tratamento especial): armas e réplicas, objectos corto-perfurantes, substâncias inflamáveis/corrosivas, engenhos explosivos, entre outros definidos na regulamentação.</p>
${passos([
  'Ao detectar, <strong>não manuseie</strong> desnecessariamente o que possa ser perigoso; isole e sinalize.',
  'Siga o procedimento do PSA para o tipo de artigo (retenção, encaminhamento, autoridade a chamar).',
  '<strong>Registe</strong> a ocorrência (há formulários próprios: registo de artigos proibidos detectados).',
])}
${pergunta('Porque é que o rastreio aleatório existe, se já há pórtico e RX?', 'Porque imprevisibilidade é dissuasão: um controlo que não se consegue prever é muito mais difícil de contornar. O aleatório fecha a brecha da rotina.')}
` },
  ],
};
const A_M4 = {
  titulo: 'Resposta a ameaças e incidentes',
  descricao: 'Ameaça de bomba, artigo suspeito, QBRN e outras ameaças — como reagir.',
  aulas: [
    { titulo: 'Ameaça de bomba e artigo suspeito', tipo: 'texto', duracao_min: 8, creditos: CRED, conteudo_texto: `
<p>Perante uma <strong>ameaça</strong> (telefónica, escrita) ou um <strong>artigo/bagagem suspeita</strong>, a regra é não improvisar — seguir o procedimento e avisar.</p>
${callout('aviso', 'Regra dos 4 «não» com um artigo suspeito', '<p><strong>Não</strong> toque. <strong>Não</strong> mova. <strong>Não</strong> cubra com objectos nem use rádio/telemóvel junto dele. <strong>Não</strong> deixe que outros se aproximem — isole e afaste pessoas.</p>')}
${passos([
  'Dê o <strong>alarme</strong> pelos meios definidos e avise o responsável de segurança / sala operativa.',
  'Ao receber uma ameaça telefónica, <strong>mantenha a pessoa a falar</strong> e anote tudo (hora, voz, ruídos, exigências) no formulário de recepção de ameaça.',
  'Prepare, se ordenado, a <strong>evacuação</strong> e o encaminhamento conforme o plano.',
  '<strong>Registe</strong> a ocorrência para investigação posterior.',
])}
` },
    { titulo: 'Outras ameaças: QBRN, MANPAD, cibernética', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>O leque de ameaças é mais largo do que armas e explosivos:</p>
<ul>
<li><strong>QBRN</strong> — química, biológica, radiológica ou nuclear: exige meios e procedimentos especializados; o seu papel é reconhecer, isolar e chamar.</li>
<li><strong>MANPAD</strong> — míssil portátil contra aeronaves na aproximação/descolagem: releva a vigilância do perímetro e das zonas envolventes.</li>
<li><strong>Ameaça cibernética</strong> — ataque aos sistemas de informação do aeroporto (ver módulo seguinte).</li>
</ul>
${callout('info', 'O denominador comum', '<p>Vigilância atenta, comunicação rápida e procedimento claro. A maioria dos ataques evitados foram-no por alguém que <strong>reparou e avisou a tempo</strong>.</p>')}
` },
    { titulo: 'Casos reais que mudaram a segurança da aviação', tipo: 'texto', duracao_min: 10, creditos: CRED, conteudo_texto: `
<p>Quase todas as regras que hoje cumprimos nasceram de um ataque. Conhecer os casos ajuda a perceber <strong>porquê</strong> — e a não repetir o erro que os tornou possíveis.</p>
${acordeao([
  ['Air India 182 (1985) — bomba na bagagem de porão', '<p>Um engenho explosivo numa mala de porão destruiu o voo sobre o Atlântico (329 vítimas). <strong>A lição:</strong> a bagagem de porão tem de estar associada a um passageiro embarcado — nasce a <strong>reconciliação bagagem-passageiro</strong> (não voa bagagem de quem não embarcou).</p>'],
  ['Pan Am 103 — Lockerbie (1988)', '<p>Uma bomba escondida num rádio, em bagagem de porão, destruiu o avião sobre a Escócia (270 vítimas). <strong>A lição:</strong> impulsionou a <strong>inspecção de 100% da bagagem de porão</strong> e a adopção de sistemas automáticos de detecção de explosivos (<strong>EDS</strong>).</p>'],
  ['11 de Setembro de 2001', '<p>Quatro aeronaves desviadas e usadas como arma (quase 3000 vítimas). <strong>A lição:</strong> reforço profundo do rastreio, <strong>portas de cockpit blindadas e trancadas</strong>, revisão dos artigos proibidos em cabina e maior partilha de informação de segurança.</p>'],
  ['Complot dos líquidos (2006)', '<p>Um plano para detonar explosivos líquidos em voos transatlânticos foi desmantelado. <strong>A lição:</strong> as regras de <strong>líquidos, aerossóis e géis (LAGs)</strong> na bagagem de cabina — os limites de volume que ainda hoje se aplicam.</p>'],
  ['Tentativa de 25/12/2009 — explosivo não-metálico', '<p>Um passageiro tentou detonar explosivo escondido na roupa; não foi detectado pelo pórtico de metais. <strong>A lição:</strong> acelerou os <strong>scanners de corpo</strong> e as técnicas que não dependem só de metal.</p>'],
  ['MetroJet 9268 — Sinai (2015)', '<p>Um engenho a bordo destruiu o avião pouco após a descolagem (224 vítimas); a hipótese central foi a colocação por <strong>cumplicidade interna</strong>. <strong>A lição:</strong> reforço do <strong>controlo de acessos e do rastreio do próprio pessoal</strong> (ameaça <em>insider</em>) e dos programas de cultura de segurança.</p>'],
])}
${callout('aviso', 'O fio condutor', '<p>Bagagem associada ao passageiro, inspecção a 100%, controlo de quem entra (incluindo o pessoal), imprevisibilidade e partilha de informação. Cada regra «chata» que cumpre está escrita com a lição de um caso real.</p>')}
${pergunta('Que mudança de segurança ficou associada a Lockerbie (PA 103)?', 'A inspecção de 100% da bagagem de porão e a adopção de sistemas de detecção de explosivos (EDS).')}
` },
  ],
};
const A_M5 = {
  titulo: 'Cibersegurança na aviação',
  descricao: 'A segurança dos sistemas de informação do aeroporto (ICAO Anexo 17, Emenda 17).',
  aulas: [
    { titulo: 'Porque é que a cibersegurança é AVSEC', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Desde a <strong>Emenda 17 ao Anexo 17</strong>, a protecção dos <strong>sistemas de informação e comunicação críticos</strong> faz parte da segurança da aviação. Um ataque informático pode ter efeitos físicos: parar o rastreio, falsear informação de voos, abrir acessos.</p>
${tabela(['Boa prática', 'Porquê'], [
  ['Inventariar e classificar os activos TIC por criticidade', 'Não se protege o que não se conhece.'],
  ['Controlo de acessos e palavras-passe fortes', 'A maioria das intrusões começa numa credencial fraca ou partilhada.'],
  ['Canal confidencial de relatos (<em>insider threat</em>)', 'Permite reportar indícios sem medo; a ameaça interna é das mais difíceis de ver.'],
  ['Cópias de segurança e plano de recuperação', 'Para voltar ao serviço depressa após um incidente.'],
])}
${callout('dica', 'A sua parte', '<p>Não partilhe senhas, desconfie de emails e links estranhos, bloqueie o ecrã ao sair, e reporte o que lhe parecer errado. A cibersegurança começa no utilizador.</p>')}
` },
  ],
};
const A_M6 = {
  titulo: 'Avaliação de risco AVSEC',
  descricao: 'Como se mede o risco: ameaça, vulnerabilidade e severidade (metodologia ICAO Doc 8973).',
  aulas: [
    { titulo: 'Ameaça × Vulnerabilidade × Severidade', tipo: 'texto', duracao_min: 9, creditos: CRED, conteudo_texto: `
<p>A avaliação de risco AVSEC combina três dimensões, cada uma numa escala de 1 (baixa) a 5 (alta):</p>
${tabela(['Dimensão', 'Pergunta que responde'], [
  ['<strong>Probabilidade / Ameaça</strong>', 'Quão plausível é o cenário (intenção + capacidade + sinais de planeamento)?'],
  ['<strong>Vulnerabilidade</strong>', 'Até que ponto as nossas medidas <em>falham</em> em mitigar a ameaça?'],
  ['<strong>Severidade</strong>', 'Qual a gravidade das consequências (vidas, economia, serviço, reputação)?'],
])}
<p>O risco resulta do cruzamento destas dimensões em <strong>matrizes</strong> (ameaça×severidade e ameaça×vulnerabilidade). Primeiro mede-se o <strong>risco inicial</strong>; depois de aplicar medidas, o <strong>risco residual</strong>. Trata-se o risco em ciclos, até ficar aceitável.</p>
${callout('info', 'Objectividade', '<p>Para não ser subjectivo, a severidade avalia-se por vários eixos (vidas, economia, continuidade, reputação) e documenta-se a escolha. Uma avaliação que não se consegue justificar numa auditoria não vale.</p>')}
${callout('aviso', 'Ferramenta dedicada', '<p>A SGA tem uma ferramenta própria de avaliação de risco AVSEC (questionários, inventário de activos, matrizes e relatórios). Este módulo dá-lhe a <strong>linguagem</strong>; a prática faz-se nessa ferramenta.</p>')}
` },
    { titulo: 'Glossário NTA 32 — os termos que vai ouvir', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Guarde este glossário — são os termos que atravessam todos os documentos AVSEC.</p>
${glossarioHtml}
` },
  ],
};

// ════════════════════════════════ CURSO B — AVSEC no Portal (GED) ════════════════════════════════
const B_M1 = {
  titulo: 'Documentos classificados e need-to-know no portal',
  descricao: 'O que torna um documento AVSEC restrito e quem o pode ver.',
  aulas: [
    { titulo: 'O que é um documento AVSEC-restrito', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>No Portal de Documentos (GED), um documento fica sob <strong>regime de vista restrita AVSEC</strong> quando é <strong>classificado</strong>, quando é <strong>«secreto»</strong>, ou quando pertence a um <strong>manual do setor AVSEC</strong> (PSA, AVSEC, PFT).</p>
${callout('aviso', 'Só credenciados vêem', '<p>Estes documentos <strong>não</strong> aparecem a quem não tem credencial AVSEC activa — mesmo que a pessoa tenha acesso ao aeroporto. É o «need-to-know» aplicado ao portal: ver é um privilégio credenciado, não um direito de quem lá trabalha.</p>')}
<p>Administradores e gestores documentais vêem para gerir. Todos os outros precisam de credencial — que se obtém, entre outras vias, concluindo a formação AVSEC.</p>
` },
  ],
};
const B_M2 = {
  titulo: 'Cópias controladas e Lista de Páginas Efectivas',
  descricao: 'Como se controla quem tem cópia e que o documento está completo e actual.',
  aulas: [
    { titulo: 'Cópias controladas e LPE', tipo: 'texto', duracao_min: 7, creditos: CRED, conteudo_texto: `
<p>Os programas AVSEC distribuem-se em <strong>cópias controladas</strong>: cada cópia é numerada e entregue a um detentor identificado, que responde por ela. Isto cumpre a obrigação legal de só disponibilizar os programas a credenciados e de saber, a todo o momento, quem tem o quê.</p>
<p>A <strong>Lista de Páginas Efectivas (LPE)</strong> diz quais as páginas em vigor e a sua revisão — serve para o detentor confirmar que a sua cópia está <strong>completa e actualizada</strong>, sem páginas a mais nem a menos.</p>
${callout('info', 'Conferência periódica', '<p>As cópias controladas são conferidas periodicamente (conferência semestral no regime AVSEC). É assim que se garante que nenhuma cópia «ficou para trás» numa revisão.</p>')}
` },
  ],
};
const B_M3 = {
  titulo: 'Credenciamento no portal',
  descricao: 'O registo de credenciados: âmbito, validade e revogação.',
  aulas: [
    { titulo: 'Quem pode possuir cópia', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>O portal mantém um <strong>Registo de Credenciados</strong> — as pessoas autorizadas a possuir cópia de documentos classificados. Cada credencial tem:</p>
${passos([
  '<strong>Âmbito</strong>: que aeroporto e que manual(is) cobre;',
  '<strong>Necessidade de saber</strong>: o fundamento escrito (obrigatório — uma credencial sem fundamento não se defende);',
  '<strong>Validade</strong> e <strong>dever de sigilo</strong> aceite;',
  '<strong>Estado</strong>: activo, suspenso ou revogado. Revoga-se com data e motivo — <strong>não se apaga</strong>.',
])}
${callout('dica', 'Concluir este curso conta', '<p>Ao concluir a formação AVSEC, fica assinalado como <strong>elegível</strong> para credenciamento. O gestor AVSEC confirma e emite a credencial com o âmbito certo.</p>')}
` },
  ],
};
const B_M4 = {
  titulo: 'Descarga protegida de documentos AVSEC',
  descricao: 'Tarja, senha gerada e entrega em canal separado.',
  aulas: [
    { titulo: 'Como descarregar com segurança', tipo: 'texto', duracao_min: 6, creditos: CRED, conteudo_texto: `
<p>Nos documentos AVSEC, o botão de descarga é <strong>«PDF Protegido»</strong>. Ao carregar nele, o portal:</p>
${passos([
  'carimba a tarja <strong>«INFORMAÇÃO RESTRITA AVSEC»</strong> em todas as páginas;',
  'encripta o PDF com uma <strong>senha gerada na hora</strong> (só permite impressão);',
  'descarrega o ficheiro e <strong>mostra-lhe a senha uma única vez</strong>.',
])}
${callout('aviso', 'Entrega em canal separado', '<p>Envie o <strong>ficheiro</strong> por um canal e a <strong>senha</strong> por outro (SMS, chamada, outra plataforma). <strong>Nunca</strong> no mesmo canal. Se os dois viajam juntos, a protecção não vale nada.</p>')}
${callout('info', 'A senha não se guarda', '<p>Só fica no log de auditoria um <strong>hash curto</strong> da senha (acesso de administrador). A senha em claro não é guardada — se fechar a caixa sem a anotar, gera o PDF outra vez.</p>')}
` },
  ],
};

// ─────────────────────── perguntas ───────────────────────
const P_A = [
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'O que distingue AVSEC (Security) de SMS/SGSO (Safety)?', opcoes: op([['AVSEC protege contra actos intencionais (ilícitos); Safety previne acidentes não intencionais', true], ['São a mesma coisa com nomes diferentes', false], ['AVSEC é só para o lado terra', false], ['Safety trata de armas e explosivos', false]]), explicacao: 'Security = ameaças intencionais; Safety = acidentes não intencionais.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'Qual é o documento AVSEC «mãe» de um aeroporto?', opcoes: op([['O PSA — Programa de Segurança do Aeroporto', true], ['O Anexo 17', false], ['A matriz de risco', false], ['O manual de operações', false]]), explicacao: 'O PSA descreve como o aeroporto cumpre o PNSAC e a NTA 32.' },
  { categoria: 'A', tipo: 'vf', enunciado: 'Uma credencial para uma zona autoriza o acesso a qualquer área restrita do aeroporto.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'A credencial vale para a zona e o tempo para que foi emitida — não é passe livre.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'Perante um artigo suspeito, o que NÃO se deve fazer?', opcoes: op([['Tocar, mover ou usar rádio/telemóvel junto dele', true], ['Isolar a área', false], ['Afastar pessoas', false], ['Dar o alarme e avisar o responsável', false]]), explicacao: 'Regra dos «não»: não tocar, não mover, não usar rádio junto, não deixar aproximar.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'Para que serve o EDS?', opcoes: op([['Detecção automática de explosivos na bagagem', true], ['Detectar metais em pessoas', false], ['Videovigilância', false], ['Controlar o acesso de viaturas', false]]), explicacao: 'EDS = Explosives Detection System (bagagem de porão).' },
  { categoria: 'A', tipo: 'vf', enunciado: 'Equipamentos de rastreio (pórtico, RX) precisam de testes e calibração com registo.', opcoes: op([['Verdadeiro', true], ['Falso', false]]), explicacao: 'Sem teste válido registado, o equipamento não conta para a inspecção.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'Na avaliação de risco, a «vulnerabilidade» mede...', opcoes: op([['até que ponto as nossas medidas falham em mitigar a ameaça', true], ['o número de passageiros', false], ['a idade do aeroporto', false], ['o custo do equipamento', false]]), explicacao: 'Alta vulnerabilidade = sem mitigação eficaz; baixa = mitigação adequada.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'Desde que emenda ao Anexo 17 a cibersegurança faz parte da AVSEC?', opcoes: op([['Emenda 17', true], ['Nunca fez parte', false], ['Só no Doc 8973', false], ['Emenda 1', false]]), explicacao: 'A Emenda 17 ao Anexo 17 integrou a protecção dos sistemas de informação críticos.' },
  { categoria: 'A', tipo: 'vf', enunciado: 'O rastreio aleatório existe porque a imprevisibilidade dificulta contornar o controlo.', opcoes: op([['Verdadeiro', true], ['Falso', false]]), explicacao: 'Imprevisibilidade = dissuasão; fecha a brecha da rotina previsível.' },
  { categoria: 'A', tipo: 'escolha_unica', enunciado: 'O que é a NTA 32?', opcoes: op([['A norma da ANAC Angola que regulamenta a segurança da aviação civil', true], ['Um tipo de raio-X', false], ['Um míssil', false], ['Uma zona do aeroporto', false]]), explicacao: 'NTA 32 = Norma Técnica Aeronáutica 32 da ANAC.' },
];
const P_B = [
  { categoria: 'B', tipo: 'escolha_unica', enunciado: 'Quando é que um documento fica sob vista restrita AVSEC no portal?', opcoes: op([['Quando é classificado, é «secreto», ou pertence a um manual do setor AVSEC', true], ['Sempre que tem um PDF', false], ['Só se estiver na lixeira', false], ['Nunca — todos os documentos são iguais', false]]), explicacao: 'Classificado OU secreto OU setor AVSEC → vista restrita.' },
  { categoria: 'B', tipo: 'vf', enunciado: 'Ter acesso ao aeroporto chega para ver os documentos AVSEC desse aeroporto.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'É preciso credencial AVSEC activa; o acesso ao aeroporto não basta.' },
  { categoria: 'B', tipo: 'escolha_unica', enunciado: 'Para que serve a Lista de Páginas Efectivas (LPE)?', opcoes: op([['Confirmar que a cópia está completa e na revisão em vigor', true], ['Listar os passageiros', false], ['Guardar senhas', false], ['Registar voos', false]]), explicacao: 'A LPE diz quais as páginas em vigor e a sua revisão.' },
  { categoria: 'B', tipo: 'vf', enunciado: 'Uma credencial AVSEC, quando deixa de valer, apaga-se do registo.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'Revoga-se com data e motivo; a linha fica — não se apaga.' },
  { categoria: 'B', tipo: 'escolha_unica', enunciado: 'Ao descarregar um documento AVSEC com «PDF Protegido», como deve entregar o ficheiro e a senha?', opcoes: op([['O ficheiro por um canal e a senha por outro, nunca juntos', true], ['Os dois no mesmo email', false], ['A senha dentro do próprio PDF', false], ['Sem senha, é mais rápido', false]]), explicacao: 'Canais separados: se viajam juntos, a protecção não vale.' },
  { categoria: 'B', tipo: 'vf', enunciado: 'A senha do PDF protegido fica guardada em claro no sistema.', opcoes: op([['Verdadeiro', false], ['Falso', true]]), explicacao: 'Só fica um hash curto no log de auditoria; a senha em claro não é guardada.' },
];

const quiz = (titulo, aprovadoMsg) => ({
  titulo, descricao: 'Avaliação final. Nota mínima para aprovação: 70%.', ativo: true, ordem: 1,
  nota_minima: 70, tentativas_max: 3, tempo_limite_min: 20,
  baralhar_perguntas: true, baralhar_opcoes: true, rever_apos: true, gera_certificado: true, requer_aulas_concluidas: true, modo_sem_consulta: false,
  feedback_faixas: [
    { min: 0, max: 69, mensagem: 'Reveja os módulos assinalados e tente de novo — tem 3 tentativas, e cada uma sorteia perguntas do banco.' },
    { min: 70, max: 89, mensagem: aprovadoMsg },
    { min: 90, max: 100, mensagem: 'Excelente! ' + aprovadoMsg },
  ],
});

export const CURSOS = [
  {
    curso: { ...BASE, ordem: 1, titulo: 'Segurança da Aviação Civil (AVSEC) — Formação Inicial', capa_url: `${U}/capas/avsec-completo.svg`, tipo_formacao: 'inicial', validade_meses: 24, prazo_dias: null, descricao: 'Fundamentos de AVSEC, zonas e acessos, rastreio, resposta a ameaças, cibersegurança e avaliação de risco. Base para o credenciamento AVSEC.' },
    modulos: [A_M1, A_M2, A_M3, A_M4, A_M5, A_M6], perguntas: P_A, quiz: quiz('Avaliação — AVSEC Formação Inicial', 'Aprovado. Fica assinalado como elegível para credenciamento AVSEC — o gestor AVSEC confirma e emite a credencial.'),
  },
  {
    curso: { ...BASE, ordem: 2, nivel: 'iniciante', titulo: 'AVSEC no Portal de Documentos (GED)', capa_url: `${U}/capas/avsec-portal.svg`, tipo_formacao: 'inicial', validade_meses: null, prazo_dias: null, descricao: 'Como os documentos AVSEC vivem no portal: classificação e need-to-know, cópias controladas e LPE, credenciamento, e descarga protegida com tarja e senha.' },
    modulos: [B_M1, B_M2, B_M3, B_M4], perguntas: P_B, quiz: quiz('Avaliação — AVSEC no Portal', 'Aprovado. Já sabe operar os documentos AVSEC no portal com segurança.'),
  },
];

export const TRILHA = { titulo: 'AVSEC — Segurança da Aviação', descricao: 'Formação AVSEC: domínio (formação inicial) + operação no portal de documentos.', sequencial: true, cursos: ['Segurança da Aviação Civil (AVSEC) — Formação Inicial', 'AVSEC no Portal de Documentos (GED)'] };
