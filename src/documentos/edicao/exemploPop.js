// POP de exemplo (contrato v1) — «Inspecção diária da área de movimento», FNLU.
// Usado nos testes dos geradores e como pré-visualização do editor.

const t = (text, ...marcas) => ({ type: 'text', text, ...(marcas.length ? { marks: marcas.map((m) => ({ type: m })) } : {}) });
const p = (...conteudo) => ({ type: 'paragraph', content: conteudo.map((c) => (typeof c === 'string' ? t(c) : c)) });
const h = (level, texto) => ({ type: 'heading', attrs: { level }, content: [t(texto)] });
const li = (...blocos) => ({ type: 'listItem', content: blocos.map((b) => (typeof b === 'string' ? p(b) : b)) });
const ul = (...itens) => ({ type: 'bulletList', content: itens.map((i) => (typeof i === 'string' ? li(i) : i)) });
const ol = (...itens) => ({ type: 'orderedList', attrs: { start: 1 }, content: itens.map((i) => (typeof i === 'string' ? li(i) : i)) });
const cel = (texto, cab = false, attrs = {}) => ({
  type: cab ? 'tableHeader' : 'tableCell',
  attrs: { colspan: 1, rowspan: 1, ...attrs },
  content: [p(texto)],
});
const linha = (cab, ...celulas) => ({ type: 'tableRow', content: celulas.map((c) => (typeof c === 'string' ? cel(c, cab) : c)) });
const doc = (...blocos) => ({ type: 'doc', content: blocos });

export const exemploPop = {
  schema: 1,
  modelo: 'POP',
  cabecalho: {
    numero: 'POP-FNLU-OPS-012',
    titulo: 'Inspecção diária da área de movimento',
    revisao: '01',
    data: '2026-03-15',
    aeroporto: 'FNLU',
    aeroportoNome: 'Aeroporto Internacional 4 de Fevereiro',
    elaboradoPor: 'Técnico de Operações',
    verificadoPor: 'Chefe de Operações Aeroportuárias',
    aprovadoPor: 'Director de Operações',
    classificacao: 'Uso interno',
  },
  seccoes: [
    {
      id: 's1-objectivo', chave: 'objectivo', titulo: 'Objectivo', obrigatoria: true,
      conteudo: doc(
        p('Estabelecer o método de execução, registo e comunicação da ', t('inspecção diária da área de movimento', 'bold'),
          ' (pistas, caminhos de circulação e placas de estacionamento), de forma a garantir que as superfícies, ajudas visuais e faixas se mantêm em condições seguras para a operação de aeronaves.'),
      ),
    },
    {
      id: 's2-ambito', chave: 'ambito', titulo: 'Âmbito e aplicabilidade', obrigatoria: true,
      conteudo: doc(
        p('Aplica-se a todo o pessoal da Direcção de Operações do Aeroporto Internacional 4 de Fevereiro (FNLU) que realize inspecções na área de movimento, bem como às equipas de manutenção chamadas a intervir na sequência de uma inspecção.'),
        p('Abrange:'),
        ul('Pistas 05/23 e 07/25, incluindo faixas e áreas de segurança de fim de pista (RESA);',
          'Caminhos de circulação A, B, C, D, E e F;',
          'Placas de estacionamento de aeronaves (Placa Norte, Placa Sul e Placa de Carga).'),
      ),
    },
    {
      id: 's3-referencias', chave: 'referencias', titulo: 'Referências', obrigatoria: true,
      conteudo: doc(
        ul(
          li(p(t('ICAO Anexo 14', 'italic'), ', Volume I — Projecto e Operação de Aeródromos, capítulo 10.')),
          li(p(t('ICAO Doc 9137', 'italic'), ' — Airport Services Manual, Parte 8 (Serviços Operacionais) e Parte 9 (Práticas de Manutenção).')),
          li(p('Manual de Operações do Aeródromo (MOA) do FNLU, Revisão n.º 03/26.')),
          li(p('Instrutivo ANAC 22A.117.001.A — Formato Global de Notificação (GRF).')),
        ),
      ),
    },
    {
      id: 's4-definicoes', chave: 'definicoes', titulo: 'Definições e abreviaturas', obrigatoria: false,
      conteudo: doc(
        {
          type: 'table',
          content: [
            linha(true, 'Termo', 'Definição'),
            linha(false, 'FOD', 'Foreign Object Debris — qualquer objecto estranho na área de movimento que possa danificar aeronaves ou equipamentos.'),
            linha(false, 'RCR', 'Runway Condition Report — relatório de condição da pista, segundo o Formato Global de Notificação.'),
            linha(false, 'RWYCC', 'Runway Condition Code — código de condição da pista, de 0 a 6.'),
            linha(false, 'TWR', 'Torre de controlo do aeródromo.'),
            linha(false, 'NOTAM', 'Aviso aos aeronavegantes sobre alterações no estado das instalações ou serviços.'),
          ],
        },
      ),
    },
    {
      id: 's5-responsabilidades', chave: 'responsabilidades', titulo: 'Responsabilidades', obrigatoria: true,
      conteudo: doc(
        h(2, 'Chefe de Operações Aeroportuárias'),
        p('Garante a execução das inspecções nos horários definidos, valida os registos e decide sobre o encerramento total ou parcial de superfícies.'),
        h(2, 'Técnico de Operações (inspector)'),
        p('Executa a inspecção, regista as não conformidades com fotografia e localização, e comunica de imediato à ', t('TWR', 'bold'), ' qualquer situação que afecte a segurança operacional.'),
        h(2, 'Manutenção'),
        p('Corrige as anomalias reportadas nos prazos da tabela do ponto 6.3 e confirma a reposição ao Chefe de Operações.'),
      ),
    },
    {
      id: 's6-procedimento', chave: 'procedimento', titulo: 'Procedimento', obrigatoria: true,
      conteudo: doc(
        h(2, 'Preparação'),
        ol('Confirmar o veículo de inspecção (rádio em 118,1 MHz, luz rotativa âmbar, bandeira xadrez).',
          'Levantar o formulário FR-FNLU-OPS-031 «Registo de inspecção da área de movimento» e o recipiente para FOD.',
          'Pedir à TWR autorização para entrar na pista, indicando a rota e a duração prevista.'),
        {
          type: 'blockquote',
          content: [
            p(t('Atenção:', 'bold'), ' nunca entrar numa pista sem autorização expressa e colacionada da TWR. Ao primeiro sinal de perda de comunicação rádio, abandonar a pista pela saída mais próxima e aguardar fora da faixa.'),
          ],
        },
        h(2, 'Execução da inspecção'),
        p('A inspecção é feita a velocidade não superior a ', t('40 km/h', 'bold'), ', em sentido contrário ao da aterragem, percorrendo cada metade da pista separadamente. Para cada superfície verificar:'),
        ol(
          li(p('Estado do pavimento: fissuras, buracos, desagregação, borracha acumulada.')),
          li(p('Presença de FOD, contaminantes (água, óleo, areia) e fauna.'), ul('Registar a localização aproximada (distância à soleira e lado).', 'Recolher o FOD e entregá-lo no fim da inspecção.')),
          li(p('Ajudas visuais: luzes fundidas ou partidas, sinalização horizontal apagada, placas danificadas.')),
          li(p('Faixas e RESA: obstáculos, vegetação acima de 30 cm, erosão.')),
        ),
        h(3, 'Horários'),
        p('As inspecções realizam-se ', t('três vezes por dia', 'underline'), ': antes da primeira operação (05h30), às 12h00 e ao pôr-do-sol, e sempre que a TWR ou um piloto reportarem uma anomalia.'),
        h(2, 'Prazos de correcção'),
        {
          type: 'table',
          content: [
            linha(true, 'Prioridade', 'Exemplo de anomalia', 'Acção imediata', 'Prazo de correcção'),
            linha(false, 'A — Crítica', 'Buraco na pista, FOD de grande dimensão', 'Encerrar a superfície; NOTAM', 'Imediato'),
            linha(false, 'B — Elevada', 'Luzes de eixo de pista fundidas (≥ 3 seguidas)', 'Informar a TWR', '24 horas'),
            linha(false, 'C — Média', 'Sinalização horizontal pouco visível', 'Registar', '30 dias'),
            linha(false, 'D — Baixa', 'Vegetação alta na faixa', 'Registar', '60 dias'),
            { type: 'tableRow', content: [cel('Nota: os prazos contam a partir da comunicação à Manutenção.', false, { colspan: 4 })] },
          ],
        },
        h(2, 'Comunicação de resultados'),
        p('No fim da inspecção, o inspector comunica à TWR «inspecção concluída, pista disponível» ou as restrições encontradas, e entrega o formulário ao Chefe de Operações até 30 minutos depois.'),
        { type: 'horizontalRule' },
        p('Quando a condição da pista se altera por contaminação, aplica-se em complemento o procedimento de avaliação e notificação de condição da pista (GRF).'),
      ),
    },
    {
      id: 's7-registos', chave: 'registos', titulo: 'Registos', obrigatoria: true,
      conteudo: doc(
        {
          type: 'table',
          content: [
            linha(true, 'Registo', 'Responsável', 'Arquivo', 'Retenção'),
            linha(false, 'FR-FNLU-OPS-031 — Registo de inspecção', 'Técnico de Operações', 'Portal de Documentos', '5 anos'),
            linha(false, 'Relatório de FOD', 'Chefe de Operações', 'Portal de Documentos', '5 anos'),
          ],
        },
      ),
    },
    {
      id: 's8-anexos', chave: 'anexos', titulo: 'Anexos', obrigatoria: false,
      conteudo: doc(p('Anexo A — Mapa da área de movimento com a rota de inspecção.')),
    },
  ],
  historico: [
    { revisao: '00', data: '2025-06-02', descricao: 'Emissão inicial.', autor: 'Técnico de Operações' },
    { revisao: '01', data: '2026-03-15', descricao: 'Inclusão da tabela de prazos de correcção e do horário ao pôr-do-sol; actualização das referências (GRF).', autor: 'Técnico de Operações' },
  ],
};

export default exemploPop;
