# Portal de Documentos — direcção de desenho

Escrito a 2026-10-02 depois de o dono olhar para o portal publicado e dizer que a primeira impressão não serve.
Baseia-se na pesquisa em `pesquisa-mercado-ged.md` (secção 7) e vale para **todos** os ecrãs do portal.

## O que está mal hoje, em concreto

1. **O ecrã de entrada repete-se.** O nome do portal e o slogan aparecem no cabeçalho e outra vez no painel escuro,
   e os três botões (Biblioteca, Pesquisa, Gestão) repetem a navegação que está por cima deles. Três elementos a
   dizer a mesma coisa, a ocupar o primeiro ecrã inteiro.
2. **Lidera com zeros.** «0 leituras por confirmar», «0 a expirar em 90 dias». Números grandes só se justificam
   quando são o assunto da página; estes dizem «não há nada para fazer» em corpo 30.
3. **Tudo é cartão.** Mesma borda, mesmo raio, mesma sombra do topo ao fundo: nada tem hierarquia, e o olho não
   sabe onde pousar.
4. **A gestão duplica-se.** O bloco «Áreas de gestão» repete, em botões, exactamente o menu que está à esquerda.
5. **A informação que interessa não está na lista.** Cada documento mostra «Outro» como tipo (nenhum está
   classificado) e repete o número no título e por baixo dele. Falta o que a lei manda ver de relance: revisão,
   data de entrada em vigor e validade.
6. **Cartões onde devia haver tabela.** Duzentos e dezassete documentos em cartões de três colunas obrigam a
   percorrer o ecrã para ver o que uma linha de tabela diria de uma vez.

## Princípios

- **É uma ferramenta de trabalho, não uma montra.** O primeiro ecrã põe a pessoa a um clique de um documento.
- **Nada duplicado.** Se está no menu, não volta a ser botão na página. Se está no cabeçalho, não se repete no corpo.
- **Densidade antes de decoração.** Lista por omissão; grelha só onde a miniatura informa.
- **Números só quando são o assunto**, e nunca a liderar com zeros. Um indicador a zero vira uma linha de texto
  («Nada a expirar nos próximos 90 dias»), não um cartão.
- **Cada documento mostra sempre:** número, estado, versão e data de entrada em vigor, validade. É o que a lei
  manda ter à mão e o que evita que alguém use a cópia que tem no computador.
- **Um só aviso de largura total em todo o produto**, reservado a «está a ver uma versão substituída». Se tudo
  avisa, nada avisa.
- **O estado vive no endereço.** Pasta, filtros, pesquisa e separador em `?`, para qualquer vista ser partilhável e
  citável num relatório de auditoria.
- **Pré-visualização**: painel lateral para triagem, página própria para leitura. **Nunca janela modal** — tapa
  justamente a lista que a pessoa precisa de consultar.
- **Isto é usado em pista, ao sol.** Modo claro por omissão, contraste alto, alvos de toque generosos.

## Sistema

### Cor
Fundo `#F7F8F7` (claro) / `#0F1416` (escuro). Superfície branca / `#151C1E`. Tinta `#14191B` / `#E8EDEA`.
Acento azul-petróleo `#0B5159` (claro) / `#5FBDC2` (escuro) — distingue da Universidade, que é violeta.
Semânticos, **separados do acento**: verde `#1F6A45` (em vigor), âmbar `#8A5B00` (a expirar, em revisão),
vermelho `#A62B21` (expirado, obsoleto, destrutivo). Linhas `#DDE2DF` / `#2A3436`.
Cinzentos com ligeiro desvio para o acento, nunca cinzento puro.

### Tipografia
Interface e tabelas: a família já usada no projecto. **Números, referências e códigos de documento em
monoespaçado com algarismos tabulares** (`font-variant-numeric: tabular-nums`) — alinham em coluna e lêem-se como
referências, que é o que são. Corpo mínimo 16 px; metadados nunca abaixo de 14 px.

### Espaço e densidade
Escala de 4 px. Linhas de tabela a 48 px por omissão, com comutador 40/48/56 guardado por pessoa.
Máximo de 5 a 7 colunas visíveis; o resto por menu de colunas.

### Componentes
- **Tabela**: cabeçalho fixo, divisória de 1 px, **sem zebra**. Acções de linha sempre focáveis por teclado, nunca
  só visíveis ao passar o rato. Selecção abre barra fixa em baixo com a contagem e as acções.
- **Selo de estado**: cor **e** texto, vocabulário fechado (Rascunho, Em revisão, Aprovado, Em vigor, Obsoleto).
  Obsoleto em cinzento frio, não em vermelho: não é erro, é facto.
- **Validade**: forma própria além da cor. «Expira em 12 dias», «Expirou há 4 dias», «Sem validade».
- **Vazios**: dizem **porquê** está vazio e dão **uma** acção. Nunca um rectângulo em branco.
- **A carregar**: linhas-esqueleto com as dimensões reais das linhas, não rodas.
- **Erros**: dizem o que falhou e o que fazer, com botão de repetir. Sem códigos crus.

## Por ecrã

- **Início** — sem painel decorativo. Uma linha de saudação, a caixa de pesquisa bem visível, e a seguir **trabalho**:
  o que falta confirmar (só se houver), os documentos novos desde a última visita, e os aeroportos da pessoa em
  linhas compactas. Indicadores numa só tira fina, e só os que não são zero.
- **Biblioteca** — o coração. Migalhas, árvore à esquerda em ecrã grande, **tabela densa** com Nome e número,
  Estado, Versão e em vigor desde, Validade, Responsável, Actualizado. Filtros em fichas com contagem e um resumo
  dos filtros aplicados por cima da lista.
- **Pesquisa** — termo no endereço, âmbito declarado em texto por cima dos resultados, realce do termo encontrado.
- **Documento** — identidade e validade em cima, ficheiro ao centro, provas à direita (versões, quem confirmou,
  acessos). Acções destrutivas separadas do resto, no fim.
- **As minhas leituras** — lista de trabalho, não relatório.
- **Gestão** — sem bloco de atalhos que repita o menu lateral. Indicadores numa tira; a seguir as listas onde há
  trabalho a fazer. O painel responde a «o que tenho de fazer hoje», não «quantos documentos existem».

## Proibido

Painéis escuros decorativos a ocupar o primeiro ecrã. Cartões grandes para listas longas. Ícones sem rótulo.
Texto cinzento-claro sobre branco para poupar contraste. Janelas modais para ver documentos. Botões que repetem o
menu. Emojis como ícones. Mais de dois níveis de divulgação progressiva.
