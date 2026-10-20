// Modelos de documento estruturado por classe (POP, PR, PL, MA, FR, LT, RE, DO).
// Fonte única: daqui sai o seed da tabela documento_modelo (tools/ged-edicao/gerar-182.mjs escreve a migração 182)
// e é também o recurso do editor quando a tabela ainda não existe ou está vazia.
// Cada secção: { chave, titulo, obrigatoria, ajuda, exemplo, automatica? }. `automatica` = não se escreve à mão
// (o histórico de revisões vem do campo `historico` do contrato).

const HISTORICO = {
  chave: 'historico', titulo: 'Histórico de revisões', obrigatoria: true, automatica: true,
  ajuda: 'Preenchido automaticamente: cada revisão gerada pelo editor acrescenta uma linha (revisão, data, descrição, autor).',
  exemplo: '00 · 2026-10-20 · Emissão inicial · J. Silva',
};

export const MODELOS_PADRAO = [
  {
    classe_codigo: 'POP',
    nome: 'Procedimento operacional padrão',
    ordem: 10,
    schema: {
      seccoes: [
        { chave: 'objectivo', titulo: 'Objectivo', obrigatoria: true,
          ajuda: 'Uma ou duas frases: o que este procedimento garante e porque existe. Comece por um verbo no infinitivo.',
          exemplo: 'Estabelecer o procedimento de inspecção diária da área de movimento do Aeroporto, de modo a detectar e remover FOD e anomalias antes do início das operações.' },
        { chave: 'ambito', titulo: 'Âmbito e aplicabilidade', obrigatoria: true,
          ajuda: 'A quem e onde se aplica: áreas do aeroporto, serviços, turnos, situações. Diga também o que fica de fora.',
          exemplo: 'Aplica-se a todo o pessoal da Direcção de Operações que realiza inspecções na pista, caminhos de circulação e placas, em todos os turnos. Não se aplica às inspecções de manutenção de balizagem.' },
        { chave: 'referencias', titulo: 'Referências', obrigatoria: true,
          ajuda: 'Normas, regulamentos e documentos internos em que o procedimento se apoia (ICAO, ANAC, MOA, outros POP). Use uma lista.',
          exemplo: 'ICAO Anexo 14, Vol. I; ICAO Doc 9137 Parte 8; NTA aplicável da ANAC; Manual de Operações do Aeródromo (MOA), capítulo 5.' },
        { chave: 'definicoes', titulo: 'Definições e abreviaturas', obrigatoria: false,
          ajuda: 'Termos e siglas usados no texto que um leitor novo pode não conhecer. Uma tabela de duas colunas funciona bem.',
          exemplo: 'FOD — Foreign Object Debris (objecto estranho na área de movimento). AOC — Centro de Operações do Aeroporto.' },
        { chave: 'responsabilidades', titulo: 'Responsabilidades', obrigatoria: true,
          ajuda: 'Quem faz o quê: uma linha por função (não por nome de pessoa). Inclua quem executa, quem verifica e quem aprova.',
          exemplo: 'Chefe de Turno de Operações: garante a realização da inspecção e regista as anomalias. Técnico de Operações: executa a inspecção. Director de Operações: verifica o cumprimento mensal.' },
        { chave: 'procedimento', titulo: 'Procedimento', obrigatoria: true,
          ajuda: 'Os passos, por ordem, numa lista numerada. Um passo = uma acção. Use «Nota» ou «Aviso» (citação) para pontos de segurança.',
          exemplo: '1. Coordenar com a Torre de Controlo a entrada na pista. 2. Percorrer a pista no sentido contrário ao das aterragens. 3. Registar e remover qualquer FOD encontrado. 4. Informar a Torre da saída da pista.' },
        { chave: 'registos', titulo: 'Registos', obrigatoria: true,
          ajuda: 'Que registos o procedimento produz, onde ficam guardados e por quanto tempo. Indique o número do formulário, se existir.',
          exemplo: 'Ficha de Inspecção da Área de Movimento (FR-FNLU-MOA-003), arquivada no AOC durante 2 anos.' },
        { chave: 'anexos', titulo: 'Anexos', obrigatoria: false,
          ajuda: 'Fluxogramas, mapas, listas de verificação ou imagens de apoio. Pode inserir imagens directamente.',
          exemplo: 'Anexo A — Mapa dos percursos de inspecção. Anexo B — Lista de verificação.' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'PR',
    nome: 'Plano ou programa',
    ordem: 20,
    schema: {
      seccoes: [
        { chave: 'objectivo', titulo: 'Objectivo', obrigatoria: true, ajuda: 'O que o programa pretende alcançar.', exemplo: 'Definir o programa anual de manutenção preventiva das ajudas visuais.' },
        { chave: 'ambito', titulo: 'Âmbito', obrigatoria: true, ajuda: 'A que áreas, sistemas ou pessoas se aplica.', exemplo: 'Aplica-se a todos os sistemas de balizagem luminosa do aeroporto.' },
        { chave: 'referencias', titulo: 'Referências', obrigatoria: false, ajuda: 'Normas e documentos de apoio.', exemplo: 'ICAO Anexo 14; Manual do fabricante.' },
        { chave: 'responsabilidades', titulo: 'Responsabilidades', obrigatoria: true, ajuda: 'Quem coordena, executa e controla o programa.', exemplo: 'Chefe de Manutenção: coordena e reporta trimestralmente.' },
        { chave: 'actividades', titulo: 'Actividades e calendário', obrigatoria: true, ajuda: 'As actividades previstas com periodicidade ou datas. Uma tabela ajuda.', exemplo: 'Inspecção visual — diária; Medição fotométrica — semestral.' },
        { chave: 'monitorizacao', titulo: 'Monitorização e indicadores', obrigatoria: false, ajuda: 'Como se mede o cumprimento.', exemplo: 'Percentagem de actividades cumpridas no prazo (meta ≥ 95%).' },
        { chave: 'anexos', titulo: 'Anexos', obrigatoria: false, ajuda: 'Documentos de apoio.', exemplo: 'Anexo A — Calendário anual.' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'PL',
    nome: 'Plano',
    ordem: 30,
    schema: {
      seccoes: [
        { chave: 'objectivo', titulo: 'Objectivo', obrigatoria: true, ajuda: 'O que o plano garante.', exemplo: 'Estabelecer a resposta do aeroporto a uma emergência com aeronave.' },
        { chave: 'ambito', titulo: 'Âmbito', obrigatoria: true, ajuda: 'Situações e entidades abrangidas.', exemplo: 'Emergências na área de movimento e nas zonas de aproximação.' },
        { chave: 'referencias', titulo: 'Referências', obrigatoria: false, ajuda: 'Normas e documentos de apoio.', exemplo: 'ICAO Doc 9137 Parte 7.' },
        { chave: 'organizacao', titulo: 'Organização e responsabilidades', obrigatoria: true, ajuda: 'Entidades envolvidas e o papel de cada uma.', exemplo: 'Centro de Operações de Emergência, Bombeiros, Polícia, Saúde.' },
        { chave: 'accoes', titulo: 'Acções e procedimentos', obrigatoria: true, ajuda: 'O que se faz, por fase ou cenário.', exemplo: 'Fase de alerta: ... Fase de resposta: ...' },
        { chave: 'comunicacoes', titulo: 'Comunicações', obrigatoria: false, ajuda: 'Meios e contactos.', exemplo: 'Frequências, telefones de emergência.' },
        { chave: 'anexos', titulo: 'Anexos', obrigatoria: false, ajuda: 'Mapas, contactos, listas.', exemplo: 'Anexo A — Mapa quadrícula.' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'MA',
    nome: 'Manual',
    ordem: 40,
    schema: {
      seccoes: [
        { chave: 'introducao', titulo: 'Introdução', obrigatoria: true, ajuda: 'Propósito do manual e como está organizado.', exemplo: 'Este manual descreve...' },
        { chave: 'ambito', titulo: 'Âmbito e aplicabilidade', obrigatoria: true, ajuda: 'A quem se aplica.', exemplo: 'Aplica-se a todo o pessoal do aeroporto.' },
        { chave: 'definicoes', titulo: 'Definições e abreviaturas', obrigatoria: false, ajuda: 'Termos e siglas.', exemplo: 'SMS — Sistema de Gestão da Segurança Operacional.' },
        { chave: 'conteudo', titulo: 'Conteúdo', obrigatoria: true, ajuda: 'O corpo do manual. Use títulos (níveis 2 a 4) para os capítulos.', exemplo: 'Capítulo 1 — ...' },
        { chave: 'anexos', titulo: 'Anexos', obrigatoria: false, ajuda: 'Material de apoio.', exemplo: 'Anexo A — ...' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'FR',
    nome: 'Ficha ou formulário',
    ordem: 50,
    schema: {
      seccoes: [
        { chave: 'instrucoes', titulo: 'Instruções de preenchimento', obrigatoria: false, ajuda: 'Como e quando preencher o formulário.', exemplo: 'Preencher no fim de cada inspecção e entregar ao Chefe de Turno.' },
        { chave: 'campos', titulo: 'Campos do formulário', obrigatoria: true, ajuda: 'O formulário propriamente dito. Use uma tabela com os campos e espaço para preencher.', exemplo: 'Data | Hora | Inspector | Observações' },
        { chave: 'assinaturas', titulo: 'Assinaturas', obrigatoria: false, ajuda: 'Quem assina o formulário.', exemplo: 'Executado por / Verificado por' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'LT',
    nome: 'Lista',
    ordem: 60,
    schema: {
      seccoes: [
        { chave: 'objectivo', titulo: 'Objectivo', obrigatoria: false, ajuda: 'Para que serve a lista.', exemplo: 'Lista de verificação da abertura do turno.' },
        { chave: 'lista', titulo: 'Lista', obrigatoria: true, ajuda: 'Os itens, numa lista ou tabela (item, verificação, observações).', exemplo: '1. Rádios testados. 2. Viatura de inspecção abastecida.' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'RE',
    nome: 'Regulamento',
    ordem: 70,
    schema: {
      seccoes: [
        { chave: 'objecto', titulo: 'Objecto', obrigatoria: true, ajuda: 'O que o regulamento regula.', exemplo: 'O presente regulamento estabelece as regras de circulação no lado ar.' },
        { chave: 'ambito', titulo: 'Âmbito', obrigatoria: true, ajuda: 'A quem se aplica.', exemplo: 'Aplica-se a todas as pessoas e viaturas no lado ar.' },
        { chave: 'disposicoes', titulo: 'Disposições', obrigatoria: true, ajuda: 'Os artigos. Use títulos de nível 3 para cada artigo.', exemplo: 'Artigo 1.º — ...' },
        { chave: 'sancoes', titulo: 'Incumprimento e sanções', obrigatoria: false, ajuda: 'Consequências do incumprimento.', exemplo: 'O incumprimento implica a suspensão da credencial.' },
        { chave: 'entrada_vigor', titulo: 'Entrada em vigor', obrigatoria: false, ajuda: 'Quando produz efeitos.', exemplo: 'Entra em vigor na data da sua aprovação.' },
        HISTORICO,
      ],
    },
  },
  {
    classe_codigo: 'DO',
    nome: 'Documento ou acordo',
    ordem: 80,
    schema: {
      seccoes: [
        { chave: 'partes', titulo: 'Partes / enquadramento', obrigatoria: false, ajuda: 'Quem está envolvido e o contexto.', exemplo: 'SGA e a entidade X.' },
        { chave: 'conteudo', titulo: 'Conteúdo', obrigatoria: true, ajuda: 'O texto do documento.', exemplo: '...' },
        { chave: 'anexos', titulo: 'Anexos', obrigatoria: false, ajuda: 'Material de apoio.', exemplo: 'Anexo A — ...' },
        HISTORICO,
      ],
    },
  },
];

export const modeloPadraoDe = (classe) => MODELOS_PADRAO.find(m => m.classe_codigo === classe) || null;
