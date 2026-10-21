// Documento de exemplo com todos os elementos do contrato v2 do editor estruturado: texto justificado, títulos
// centrados/à direita, caixas Nota/Atenção/Aviso, imagens e tabelas com legenda numerada, listas de 3 níveis
// (ordenadas e marcadas) e quebra de página. Usado nos testes dos geradores e nas amostras para revisão.
import { exemploPop } from './exemploPop';

const t = (text, ...marcas) => ({ type: 'text', text, ...(marcas.length ? { marks: marcas.map((m) => ({ type: m })) } : {}) });
const p = (...conteudo) => ({ type: 'paragraph', content: conteudo.map((c) => (typeof c === 'string' ? t(c) : c)) });
const pa = (textAlign, ...conteudo) => ({ ...p(...conteudo), attrs: { textAlign } });
const h = (level, texto, textAlign) => ({ type: 'heading', attrs: { level, ...(textAlign ? { textAlign } : {}) }, content: [t(texto)] });
const li = (...blocos) => ({ type: 'listItem', content: blocos.map((b) => (typeof b === 'string' ? p(b) : b)) });
const ul = (...itens) => ({ type: 'bulletList', content: itens.map((i) => (typeof i === 'string' ? li(i) : i)) });
const ol = (...itens) => ({ type: 'orderedList', attrs: { start: 1 }, content: itens.map((i) => (typeof i === 'string' ? li(i) : i)) });
const cel = (texto, cab = false, attrs = {}) => ({ type: cab ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [p(texto)] });
const linha = (cab, ...celulas) => ({ type: 'tableRow', content: celulas.map((c) => (typeof c === 'string' ? cel(c, cab) : c)) });
const caixa = (tipo, ...blocos) => ({ type: 'blockquote', attrs: { tipo }, content: blocos.map((b) => (typeof b === 'string' ? p(b) : b)) });
const doc = (...blocos) => ({ type: 'doc', content: blocos });

/** PNG pequenos (gerados) para as figuras do exemplo. */
export const IMAGEM_PISTA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAB4CAIAAACl9LZYAAAB0klEQVR42u3bMY7EIBBFQc5J5NARZ+KmOENy6IiPqVblLXlHT5pxb2m9AhCoeAQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AAHB7peNwCBBBogNdDDGGNM5Ai0McakBtqXCAC/QQMg0ABeEs7xKAGmrJeE/h4AAg0g0AININAAAu0OGsCZHQACDSDQAAg0gEADkBhoZ3YA7qABBFqgAQRaoAEEGkCgBRogIdCeI4A7aAAEGkCgAfhhoJe8kFz1ItRee+3dd69A+2DZa6+9Av0O9MIzOx8se+2196+B3v4O2gfLXnvtFWj/qAIg0AAINIBACzTAikB7jgDuoAEQaACBBkCgAQQagIRAO7MDcAcNINACDSDQAg0g0AACLdAACYH2HAHcQQMg0AACDYBAAwg0AAINgEAD7BboYYwxJnIE2hhjUgPtSwSA36AB+BLo1isAgQQaQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAIEGQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBrgYA898jyPB0dWbgAAAABJRU5ErkJggg==';
export const IMAGEM_GRAFICO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACgCAIAAAA5GsY1AAACnElEQVR42u3WwQ1AQBRFUSsdKMFUQQPaUIStNpQm0YEGRCw0YCORP8F5uXvJT05Gse2HpIwVTiBBKEEoCUIJQkkQShBKglCCUBKEEoSSIJQglAShBKEkCCUIJUEoQSgJQglCSRBKEEqCUIJQEoQShJIglCD8ZnW/BuTOghBCQQihBCGEghBCCUIIBSGEEoQQCkIIBaEgFIQQCkJBKAghFISCUBBCKAghhFAQQigIIYRQEEIoCCGEUBBCKAghhFAQQigIIYRQEEIoCCGE8KJqbAOCEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGE8M6HuykgCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIXwc4ZJSQBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBC+EmE81AGBCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEII4ZsQNmaWddleQkmZf0clQShBKAlCCUIJQleQIJQglASh9NdO2V4wEVEu194AAAAASUVORK5CYII=';

const JUSTIFICADO = [
  'O presente procedimento estabelece o método de ', t('inspecção diária da área de movimento', 'bold'),
  ' do aeroporto, incluindo pistas, caminhos de circulação e placas de estacionamento. A inspecção destina-se a garantir que as superfícies, as ',
  t('ajudas visuais', 'italic'), ' e as faixas se mantêm em condições seguras para a operação de aeronaves, em conformidade com o ',
  t('Anexo 14 da ICAO', 'bold', 'italic'), ' e com o Manual de Operações do Aeródromo. Qualquer anomalia detectada é ',
  t('registada, comunicada e corrigida', 'underline'), ' nos prazos fixados neste documento.',
];

export const exemploCompleto = {
  ...exemploPop,
  cabecalho: { ...exemploPop.cabecalho, numero: 'POP-FNLU-OPS-099', titulo: 'Exemplo completo do editor estruturado' },
  seccoes: [
    {
      id: 's1-texto', chave: 'objectivo', titulo: 'Texto e alinhamentos', obrigatoria: true,
      conteudo: doc(
        h(2, 'Título centrado', 'center'),
        pa('justify', ...JUSTIFICADO),
        pa('justify', 'Parágrafo justificado com uma ', t('palavra em negrito', 'bold'), ' a meio, outra em ', t('itálico', 'italic'),
          ' e uma quebra de linha forçada no fim desta frase, que é comprida o bastante para ocupar mais de uma linha inteira:', { type: 'hardBreak' },
          'a linha antes da quebra não é esticada, tal como a última linha de cada parágrafo justificado, que fica alinhada à esquerda como no Word.'),
        pa('center', 'Parágrafo centrado: ', t('Aeroporto Internacional 4 de Fevereiro', 'bold')),
        pa('right', 'Parágrafo alinhado à direita — Luanda, 15 de Março de 2026'),
        p('Parágrafo sem alinhamento (documento antigo): sai à esquerda, exactamente como antes.'),
        h(3, 'Subtítulo alinhado à direita', 'right'),
        p('Texto normal a seguir ao subtítulo.'),
      ),
    },
    {
      id: 's2-caixas', chave: 'caixas', titulo: 'Caixas de destaque', obrigatoria: true,
      conteudo: doc(
        caixa('nota', p('A inspecção do fim do dia pode ser antecipada quando a última operação programada termina antes do pôr-do-sol.')),
        caixa('atencao', p('Nunca entrar numa pista sem ', t('autorização expressa e colacionada', 'bold'), ' da TWR.')),
        caixa('aviso', p('Perigo de jacto: manter uma distância mínima de 60 m da traseira de aeronaves com motores em funcionamento.'),
          ul('Usar protecção auditiva.', 'Não circular atrás de aeronaves em push-back.')),
        { type: 'blockquote', content: [p(t('Atenção:', 'bold'), ' caixa de um documento antigo, sem tipo (cor adivinhada pelo texto, sem rótulo).')] },
      ),
    },
    {
      id: 's3-figuras', chave: 'figuras', titulo: 'Figuras e tabelas', obrigatoria: true,
      conteudo: doc(
        pa('justify', 'As figuras e as tabelas com legenda são numeradas automaticamente, por ordem de aparecimento no documento inteiro, com numerações independentes.'),
        { type: 'image', attrs: { src: IMAGEM_PISTA, alt: 'Pista', width: '80%', legenda: 'Pista 05/23 com a marcação de eixo e as soleiras' } },
        {
          type: 'table', attrs: { legenda: 'Prazos de correcção por prioridade' },
          content: [
            linha(true, 'Prioridade', 'Exemplo de anomalia', 'Prazo'),
            linha(false, 'A — Crítica', 'Buraco na pista, FOD de grande dimensão', 'Imediato'),
            linha(false, 'B — Elevada', 'Luzes de eixo fundidas (três ou mais seguidas)', '24 horas'),
            linha(false, 'C — Média', 'Sinalização horizontal pouco visível', '30 dias'),
          ],
        },
        { type: 'image', attrs: { src: IMAGEM_GRAFICO, alt: 'Gráfico', width: '55%', legenda: 'Não conformidades por superfície no último trimestre' } },
        {
          type: 'table', attrs: { legenda: 'Equipas e turnos (células juntas)' },
          content: [
            linha(true, 'Equipa', 'Turno', 'Superfícies'),
            { type: 'tableRow', content: [cel('Equipa A', false, { rowspan: 2 }), cel('Manhã'), cel('Pista 05/23 e caminhos A a C')] },
            { type: 'tableRow', content: [cel('Tarde'), cel('Pista 07/25 e caminhos D a F')] },
            { type: 'tableRow', content: [cel('Equipa B', false, { colspan: 2 }), cel('Placas Norte, Sul e de Carga')] },
          ],
        },
        p('Uma tabela sem legenda não entra na numeração:'),
        { type: 'table', content: [linha(true, 'Registo', 'Retenção'), linha(false, 'FR-FNLU-OPS-031', '5 anos')] },
      ),
    },
    {
      id: 's4-listas', chave: 'listas', titulo: 'Listas de três níveis', obrigatoria: true,
      conteudo: doc(
        p('Lista ordenada (níveis 1., a) e i.):'),
        ol(
          li(p('Preparação do veículo de inspecção.'), ol(
            li(p('Verificar o rádio.'), ol('Frequência 118,1 MHz.', 'Teste de chamada com a TWR.')),
            li(p('Verificar a luz rotativa.')),
          )),
          li(p('Execução da inspecção.'), ol(li(p('Percorrer cada metade da pista.'), ol('Sentido contrário ao da aterragem.')))),
          'Comunicação dos resultados.',
        ),
        p('Lista marcada (marcas bola, travessão e quadrado):'),
        ul(
          li(p('Pavimento.'), ul(li(p('Fissuras e buracos.'), ul('Medir a profundidade.', 'Fotografar com escala.')), 'Borracha acumulada.')),
          li(p('Ajudas visuais.'), ul(li(p('Luzes.'), ul('Fundidas.', 'Partidas.')))),
        ),
        { type: 'pageBreak' },
        h(2, 'Depois da quebra de página'),
        pa('justify', 'Este texto começa obrigatoriamente numa página nova, por causa da quebra de página inserida no editor. ', ...JUSTIFICADO),
      ),
    },
  ],
};

export default exemploCompleto;
