# Folhas de abertura de um manual controlado

O que a lei angolana manda estar nas primeiras páginas de um manual de aeródromo, o que o Portal de Documentos
passa a gerar, e o que ficou por pressuposto.

Data: 2026-10-02. Estado: módulo escrito e provado isoladamente; falta ligar ao `server.js`
(ver `folhas-legais-ligacao.md`) e aplicar `C:\dirops\sga-onpremise\sql\164_folhas_legais.sql`.

---

## 1. De onde vem a lei

Fonte primária, lida inteira em 2026-10-02: **Instrutivo n.º 22C.107.001.A — Orientação para a Elaboração do
Manual de Operação de Aeródromo**, anexo ao Despacho n.º 1021/25 da ANAC, publicado no *Diário da República*,
II Série, n.º 36, de 24 de Fevereiro de 2025, páginas 1541 a 1586. Aprovado por Deliberação do Conselho de
Administração n.º 031/CAD.ORD/2024 e assinado pela Presidente do Conselho de Administração, Amélia Domingues
Kuvíngua. Referência de publicação: (24-2566-A-ANAC).

O PDF foi obtido de `https://doc.anac.ao/share/s/IxVwodDQR1ujl8yFUXevoQ`, pelo endereço de conteúdo
(`/share/proxy/alfresco-noauth/api/internal/shared/node/<ID>/content/…`), e é **digitalizado**: 47 páginas de
imagem, sem camada de texto. Foi lido página a página; as citações abaixo são transcrições do que lá está escrito,
com a numeração do próprio Instrutivo.

Duas correcções a premissas comuns, que `pesquisa-mercado-ged.md` já tinha registado e que a leitura confirma:
o que rege o MOA é o **NTA 22C** e este Instrutivo, não o NTA 22A; e a **Lista de Páginas Efectivas não é exigida
pelo Instrutivo do MOA** — é do regime do Programa de Segurança do Aeroporto (Instrutivo n.º 32.039.001.A).

### Os artigos que mandam nestas folhas

| Norma | O que diz, à letra |
|---|---|
| 1.1.1.1 | «O MOA deve ser digitado e impresso, com o tipo de letra arial, tamanho 12 e assinado pelo Gestor Responsável do Aeródromo.» |
| 1.1.1.2 | «O MOA deve ser produzido em formato digital e físico e deve estar disponível na Autoridade Nacional de Aviação Civil nas duas (2) versões.» |
| 1.1.1.3 | «O MOA deve conter uma Lista de Distribuição, Registo de Emendas, Definições, Acrónimos e Apêndices.» |
| 1.1.1.4 | «Todas as páginas do MOA devem conter um cabeçalho e um rodapé.» |
| 1.1.1.5 | Cabeçalho: à esquerda o logótipo do aeródromo ou do operador; ao meio o título do manual e o nome do aeródromo; à direita o número e título do capítulo, parte ou apêndice. |
| 1.1.1.6 | Rodapé: à esquerda o número de revisão e o ano de efectividade; ao meio a data da aprovação; à direita o número da página actual e o número total de páginas. |
| 1.1.1.7 | «Tanto o cabeçalho como o rodapé devem estar centralizado.» |
| 1.1.1.8 | Os documentos que fazem parte do MOA mas são publicados separadamente «devem ser referenciados no MOA e devem estar disponíveis a todo o momento para os terceiros interessados». |
| 1.1.2.1 a) | «A capa deverá conter o título do manual, o nome do aeródromo, número da edição e o ano de efectividade.» |
| 1.1.2.1 b) | «O formato de página deve ser A4 (tipo comercial padronizado 21 cm X 29,7 cm).» |
| 1.1.2.1 c) e d) | Capa com argola e folhas perfuradas, para inserir e remover páginas; separadores por capítulo. |
| **1.1.2.2** | **A ordem das nove primeiras páginas** (ver quadro seguinte). |
| Anexo 1 | Quadro da Declaração do Operador de Aeródromo e Aprovação do MOA. |
| Anexo 2 | Lista de Distribuição: `Nº | Identificação dos detentores do MOA | Empresa | Cargo/Função | Assinatura de quem recebeu o MOA`, com 20 linhas. |
| Anexo 3 | Registo de Emendas: `Nº | Data da Modificação | Data de Inserção | Inserido por | Páginas Afectadas | Resumo da Modificação | Aprovado por`. |
| Apêndice 1, 1.2 | O MOA é verificado «pelo menos, uma vez por ano»; o operador define o método de distribuição e, após cada verificação, distribui as modificações a cada detentor. |
| Apêndice 1, 1.3 | O acesso pode ser restringido «por razões de segurança ou de gestão», desde que a pessoa seja informada por outros meios. |
| Apêndice 1, 1.4 | Os detentores são identificados na lista de distribuição, que «é parte integrante do MOA», e são responsáveis por actualizar as suas cópias. |
| Apêndice 1, 1.5 | «Dentro de 30 dias de emissão de uma emenda, todos os detentores do MOA devem confirmar ao operador de aeródromo que a acção de emenda exigida foi cumprida através do retorno da página de controlo de emenda, assinada e datada.» Duas cópias da emenda vão à ANAC; uma volta assinada. As folhas de controlo «devem ser numeradas consecutivamente e datadas». Ao inserir, regista-se o número e a data da revisão, a data de inserção, **o nome em letras maiúsculas** de quem inseriu e **a assinatura** dessa pessoa. |
| Apêndice 1, 1.6 | As folhas de controlo guardam-se, inseridas consecutivamente depois do Registo de Modificações. |
| Apêndice 1, 1.7 | As corrigendas (telefone errado, gralha) fazem-se «sem aprovação prévia da ANAC», registadas «no mesmo formato que o registo de emendas». |

### A ordem imposta (1.1.2.2)

| # | Página | Modelo |
|---|---|---|
| 1 | Capa | 1.1.2.1 a) |
| 2 | Índice | — |
| 3 | Declaração do operador do aeródromo e aprovação do MOA | **Anexo 1** |
| 4 | Informações sobre a Legalidade de Titularidade do Aeródromo | — |
| 5 | Lista de Distribuição | **Anexo 2** |
| 6 | Registo de Emendas | **Anexo 3** |
| 7 | Definições | — |
| 8 | Acrónimos | — |
| 9 | Objectivo e Âmbito do Manual de Operação de Aeródromo | — |

### O que a SGA já pratica

`RINT-FNMO-RST-001` (Regimento Interno do Runway Safety Team do Namibe, revisão 00, 15/03/2025) abre assim, e foi
lido directamente do ficheiro do acervo:

- **FOLHA DE CONTROLO DA DISTRIBUIÇÃO** — `Número da Cópia | Papel/Digital | NOME | CARGO | ORGANIZAÇÃO`
- **CONTROLO DE REVISÕES** — `Número | Data | Descrição da Atualização` (a primeira linha diz «00 · 15/03/2025 ·
  Emissão Inicial»)
- **REGISTOS DE EMENDAS** — `Nº | Data de Recepção | Data de Inserção | Inserido Por | Assinatura`
- depois SUMÁRIO, DEFINIÇÕES e o capítulo 1 de ABREVIAÇÕES E ACRÓNIMOS

E o cabeçalho de cada página é um quadro com `título | Código do Documento | Revisão | Data | Página`.

Onde as duas formas divergem, **manda a lei e a coluna da SGA entra a mais, nunca a menos**. Em concreto: a folha
de distribuição sai com as quatro colunas do Anexo 2 **mais** a coluna «Papel/Digital» da SGA; e o registo de
emendas sai com as **sete** colunas do Anexo 3, não com as cinco da SGA — faltavam-lhe «Páginas Afectadas»,
«Resumo da Modificação» e «Aprovado por», que são precisamente as que um inspector lê.

---

## 2. As nove folhas, uma a uma

As nove que foram pedidas não são exactamente as nove da lista do 1.1.2.2 — e isso é bom: três das legais
(Legalidade de Titularidade, Definições, Objectivo e Âmbito) são **texto que alguém escreve**, não folhas que um
sistema possa gerar a partir de dados; e três das pedidas (controlo de revisões, lista de páginas efectivas, lista
de documentos de referência) são folhas que a lei quer, ou que a prática exige, sem as enumerar naquele ponto.
A correspondência está no fim desta secção.

Chaves do parâmetro `folhas=` da rota, pela ordem em que saem:

### 1. `rosto` — Folha de rosto (capa)

**Lei:** 1.1.2.2 a) e 1.1.2.1 a) — título do manual, nome do aeródromo, número da edição e ano de efectividade.

**O que gera:** logótipo SGA, nome da entidade emissora, título, aeródromo com código ICAO, número do documento,
e um quadro com dois campos — «Número da edição» e «Ano de efectividade» — que é a leitura literal da alínea a).
Em baixo, o espaço «Documento controlado — esta cópia é a número: ____», que é o que liga fisicamente cada
exemplar à folha de distribuição.

**Fonte dos dados:** `documento.titulo`, `documento.numero`, `documento.versao` (ou `versao_atual`),
`documentos_aeroporto.nome`/`codigo_icao`, `documento.entidade_emissora`, e o ano tirado por ordem de
`em_vigor_desde`, `publicacao_em`, `data_publicacao`, `aprovado_em`, `created_date`.

**Estado hoje:** **sai completa** para os 217 documentos do acervo. Todos têm título, versão e ano; 215 dos 217
têm aeroporto. `entidade_emissora` está vazia em todos e cai no valor por omissão «Sociedade Gestora de
Aeroportos, S.A.».

### 2. `indice` — Índice

**Lei:** 1.1.2.2 b) — segunda página.

**O que gera:** entradas a quatro níveis, com recuo, pontos de condução e número de página.

**Fonte dos dados:** tabela nova `documento_indice` (migração 164).

**Estado hoje:** **com buraco, e assumido.** A tabela nasce vazia. Um índice não se adivinha de um PDF
digitalizado — e um índice errado num manual controlado é pior do que não ter nenhum. Enquanto não houver
entradas, a folha sai com uma advertência escrita em vez de um índice falso, e o `modo=lacunas` assinala-o.

### 3. `declaracao` — Declaração do operador e aprovação

**Lei:** 1.1.2.2 c) e **Anexo 1**; 1.1.1.1 (assinatura do Gestor Responsável); NTA 22C, 22C.107 c) (aprovação
pela ANAC).

**O que gera:** o quadro do Anexo 1, campo a campo (nome do aeródromo, titular, operador, coordenadas WGS-84,
gestor, n.º e data do certificado de aeródromo), o texto da declaração, o espaço de assinatura do Director do
Aeródromo com data, e o bloco de APROVAÇÃO com o espaço do Presidente do Conselho de Administração da ANAC.
O texto por omissão é o do Anexo 1, transcrito: *«Eu declaro pela presente que as informações deste MOA são
correctas e que nenhuma informação relevante foi omissa. Eu aceito e devo cumprir com todas as especificações
nele contido.»* — com «MOA» substituído por «Manual», para servir qualquer documento.

**Fonte dos dados:** tabela nova `documento_declaracao`, com herança do registo do aeródromo
(`documentos_aeroporto`, colunas novas).

**Estado hoje:** **com buracos.** A migração 164 semeia o que pode e **não inventa o resto**:
- *coordenadas WGS-84*: copiadas de `public.aeroporto` para **17 dos 23** aeroportos; **6 ficam vazios**
  (Benguela, Cuíto Cuanavale, Ndalatando, Porto Amboim, Sumbe, Waku Kungo);
- *operador*: «Sociedade Gestora de Aeroportos, S.A.» nos 23 — não é dedução, é quem opera;
- *gestor do aeródromo*: o responsável nomeado de cada aeroporto (migração 145/146), excepto quando o registo é
  um serviço e não uma pessoa — o FNLU está como «Direcção FNLU» e fica vazio, porque um manual não é assinado
  por um serviço;
- *titular do aeródromo*: **fica vazio nos 23**. Quem é o titular é matéria de título jurídico; não se deduz;
- *n.º e data do certificado de aeródromo*: **vazios nos 23**. Ninguém os tem na base;
- *assinatura do director e aprovação da ANAC*: **vazias**. A folha sai por assinar, com um aviso impresso.

### 4. `distribuicao` — Folha de controlo da distribuição

**Lei:** 1.1.2.2 e), **Anexo 2**, Apêndice 1 §1.4 e §1.5.

**O que gera:** `N.º da Cópia | Papel/Digital | Nome | Cargo/Função | Organização | Assinatura de quem recebeu`,
com as cópias registadas em cima e o formulário pautado até 20 linhas em baixo, para assinar à mão — que é o que
o Anexo 2 é. Em rodapé da folha, a citação do §1.4 e do §1.5 (os 30 dias) e a distinção, que quase todo o
software confunde, entre **confirmação de recebimento** e **assinatura de aprovação**.

**Fonte dos dados:** tabela nova `documento_copia_controlada`.

**Estado hoje:** **vazia, por decisão.** A migração não cria cópias controladas para ninguém: quem decide a lista
de distribuição é o operador de aeródromo (Apêndice 1, §1.2), não uma migração. O que a 164 dá é a função
`documento_distribuicao_propor(documento_id)`, que sugere os detentores a partir do responsável do aeroporto e de
quem tem acesso a esse aeroporto no portal, dizendo de onde veio cada sugestão e quem já tem cópia. Enquanto não
houver cópias registadas, a folha sai como formulário pautado — útil para assinar, inútil como prova.

### 5. `revisoes` — Controlo de revisões

**Lei:** não enumerada no 1.1.2.2; é o formato que a SGA pratica (`RINT-FNMO-RST-001`) e o registo que o
Apêndice 1 §1.2 pressupõe quando exige verificação anual e distribuição das modificações.

**O que gera:** `Número | Data | Descrição da actualização | Em vigor desde | Aprovado por`, mais linhas em branco.

**Fonte dos dados:** `documento_versao` (migrações 135/152).

**Estado hoje:** **sai completa, com uma linha por documento.** Os 217 documentos têm exactamente uma versão
registada — a semente da migração 135 — pelo que a folha sai com uma linha, «Emissão inicial». É verdade: o
acervo entrou de uma vez só e não há histórico anterior a inventar. A coluna «Aprovado por» fica vazia porque
`documento_versao.aprovado_por` está vazia em todas (nenhum documento tem `aprovado_em` preenchido).

### 6. `emendas` — Registo de emendas

**Lei:** 1.1.2.2 f) e **Anexo 3**; Apêndice 1 §1.5 e §1.7.

**O que gera:** as sete colunas do Anexo 3, pela ordem do Anexo 3, com o nome de quem inseriu em MAIÚSCULAS
(§1.5.e.iv), mais linhas pautadas numeradas a seguir à última emenda. Em rodapé, a citação do §1.5.e e a regra do
§1.7 (corrigenda sem aprovação prévia). Quando há emendas distribuídas com confirmações por receber, a folha
nomeia-as e lembra o prazo de 30 dias.

**Fonte dos dados:** `documento_emenda` (migração 150, já aplicada).

**Estado hoje:** **sai como formulário em branco, e está certo.** A tabela tem zero emendas, porque nenhum
documento do acervo foi ainda emendado dentro da plataforma. Um manual na primeira edição tem mesmo o registo de
emendas vazio.

### 7. `lep` — Lista de páginas efectivas

**Lei:** **não é do MOA.** É o Instrutivo n.º 32.039.001.A (Programa de Segurança do Aeroporto) que exige Lista de
Páginas Efectivas no início do volume e conferência semestral página a página. No MOA é boa prática, e torna-se
quase indispensável quando se emenda por substituição de páginas, como o Apêndice 1 §1.5 descreve.

**O que gera:** `Página | Secção | Rev.` em três colunas por folha, para uma LEP de 200 páginas não ocupar dez.

**Fonte dos dados:** `documento_conteudo_indice.paginas` e `documento_pagina_texto` (migração 151).

**Estado hoje:** **sai, com um pressuposto declarado na própria folha.** Há contagem de páginas indexada para os
217 documentos (1612 páginas de texto extraído no total). A coluna «Secção» vem do **índice**: a última entrada de
nível 1 ou 2 cuja página é menor ou igual a esta. É a única fonte honesta — o rótulo que a indexação guarda é só
«Página N», que não diz secção nenhuma e por isso é ignorado. Sem índice registado, a coluna sai vazia.
**Pressuposto:** a plataforma guarda uma revisão por documento, não por página — todas as páginas saem
com a revisão em vigor do documento. Só deixa de ser verdade num manual emendado por substituição de páginas, em
que coexistem páginas de revisões diferentes; nesse caso a coluna tem de ser corrigida à mão enquanto a revisão
por página não for registada. Isto está impresso na folha, não escondido aqui.

### 8. `abreviaturas` — Lista de abreviaturas e acrónimos

**Lei:** 1.1.1.3 e 1.1.2.2 h).

**O que gera:** duas colunas de pares `Sigla | Significado`, ordenadas.

**Fonte dos dados:** tabela nova `documento_abreviatura` (entradas do documento + lista comum do portal).

**Estado hoje:** **sai completa a partir da lista comum.** A migração 164 semeia os **33 acrónimos do capítulo V
do próprio Instrutivo**, alíneas a) a gg) — AIP, AIS, ANAC, ASDA, ATS, DME, IFR, LDA, MNT, MOA, MSGSO, NDB, NOTAM,
NTA, PBZPA, PCN, PEA, PFOA, PGPF, PRAFS, PSCI, RESA, RNAV, RST, SGSO, SITA, SMGCS, TDZ, TODA, TORA, VFR, VOR,
WGS-84. São lei publicada, não interpretação minha; cada linha guarda a alínea de onde veio. Duas gralhas do
Diário da República («Ranway Safety Team», «Segurnaça») foram escritas correctamente e a gralha fica assinalada na
coluna `fonte`. A folha avisa, como o Instrutivo avisa, que «o operador de aeródromo deve incluir todos acrónimos
mencionados no MOA»: a lista comum é o mínimo, não o fim.

### 9. `referencias` — Lista de documentos de referência

**Lei:** 1.1.1.8.

**O que gera:** `Código | Título | Entidade emissora | Revisão | Data`, com a citação do 1.1.1.8 no topo e linhas
pautadas em baixo.

**Fonte dos dados:** tabela nova `documento_referencia`.

**Estado hoje:** **vazia.** Como ajuda, a 164 traz `documento_referencia_sugerida(documento_id)`, que procura os
números de outros documentos do acervo dentro do texto já indexado deste (migração 151) e devolve os que
aparecem, com o número de páginas em que são citados. Propõe; não grava.

### Correspondência com a lista legal do 1.1.2.2

| Ordem legal (1.1.2.2) | Folha gerada |
|---|---|
| a) Capa | `rosto` |
| b) Índice | `indice` |
| c) Declaração e aprovação (Anexo 1) | `declaracao` |
| d) Legalidade de Titularidade do Aeródromo | **não gerada** — é texto jurídico a escrever, não dados |
| e) Lista de Distribuição (Anexo 2) | `distribuicao` |
| f) Registo de Emendas (Anexo 3) | `emendas` |
| g) Definições | **não gerada** — texto do manual |
| h) Acrónimos | `abreviaturas` |
| i) Objectivo e Âmbito | **não gerada** — texto do manual |
| — | `revisoes` (prática SGA), `lep` (regime do PSA), `referencias` (1.1.1.8) |

As três não geradas não são esquecimento: são capítulos de texto que o operador escreve. A plataforma não as deve
inventar; deve é guardá-las como conteúdo e pô-las na ordem certa quando o manual for montado.

---

## 3. Cabeçalho e rodapé

Todas as folhas, excepto a capa, levam o cabeçalho e o rodapé do 1.1.1.5 e 1.1.1.6, desenhados em quadro de três
células como os exemplos do Instrutivo:

- **cabeçalho**: logótipo | título do manual + nome do aeródromo | número e título do capítulo
- **rodapé**: `Revisão n.º 00/25` | `Data: 5 de Julho de 2025` | `Página 3 de 10`

O número total de páginas é calculado depois de todas as folhas estarem compostas, e é o total **deste conjunto de
folhas**, não o do manual inteiro — ver pressupostos.

---

## 4. Pressupostos — o que não é lei, é escolha minha

1. **Arial 12 → Helvetica.** O 1.1.1.1 exige Arial 12. As catorze fontes que um PDF pode usar sem embutir nada não
   incluem a Arial; a Helvetica tem as mesmas métricas e é o substituto que qualquer leitor de PDF usa no lugar da
   Arial. O corpo sai a 12; as tabelas descem até 8 para caberem em A4. O Instrutivo dá o tamanho 12 para o texto
   do manual e não fixa o das tabelas dos anexos — cujos próprios modelos, no Diário da República, estão
   claramente abaixo de 12.
2. **A capa não leva cabeçalho.** O 1.1.1.4 diz «todas as páginas». A capa leva o rodapé, mas em vez do quadro de
   cabeçalho leva o logótipo em grande, como a capa do próprio Instrutivo. É uma leitura de senso comum e fica
   aqui declarada; se a ANAC objectar, é uma bandeira a mudar (`semCabecalho`).
3. **«Página X de Y» conta as folhas de abertura, não o manual.** Enquanto estas folhas forem geradas à parte do
   corpo do manual, o Y é o número de folhas de abertura. Quando o manual for montado inteiro na plataforma —
   folhas de abertura mais conteúdo — o Y passa a ser o total verdadeiro. Não há forma honesta de o fingir agora.
4. **A ordem das folhas é sempre a legal.** O parâmetro `folhas=` escolhe quais saem, nunca por que ordem.
5. **A revisão é por documento, não por página** (ver `lep`).
6. **«Aprovação não registada» é o que vai no rodapé** quando `documento.aprovado_em` está vazio — e está vazio
   nos 217. Preferiu-se dizê-lo a deixar o campo em branco, que se lê como falha de impressão.
7. **A Lista de Páginas Efectivas entra no MOA** por boa prática, não por obrigação do Instrutivo 22C.107.001.A.
   Para o Programa de Segurança do Aeroporto é obrigatória, e esse regime (Instrutivo n.º 32.039.001.A) tem
   exigências próprias que **não devem ser unificadas** com as do MOA.
8. **O texto da declaração** é o do Anexo 1 com «MOA» trocado por «Manual», para a folha servir qualquer documento
   controlado e não só o Manual de Operação de Aeródromo. Para um MOA, escreva-se «MOA» em
   `documento_declaracao.texto_declaracao` e passa a sair à letra.
9. **«Operador do aeródromo» = SGA** nos 23 aeroportos. É a empresa que os gere e é a dona desta plataforma.
   Não foi deduzido de nenhuma fonte jurídica; se algum aeroporto for operado por terceiro, corrige-se no registo.
10. **A confirmação de leitura registada no portal não é assinatura.** Onde a folha de distribuição mostra
    «Confirmado no portal em …», isso prova entrega e recebimento (Apêndice 1, §1.5), não autoridade sobre o
    conteúdo. A assinatura com valor probatório é a da migração 156, que **não está aplicada**.

---

## 5. O que fica por fazer

- **Dados que só pessoas têm:** titular de cada aeródromo, número e data do certificado de aeródromo, coordenadas
  dos seis aeroportos em falta, assinatura do director e aprovação da ANAC.
- **Índice:** sem ele, a segunda página legal do manual não existe. Para os manuais que importam (o MOA de cada
  aeroporto) é trabalho de uma tarde por manual.
- **Ecrã:** nada disto tem interface ainda. A rota responde `modo=lacunas` precisamente para a página de
  conformidade poder mostrar, por documento, quais das nove folhas estão prontas; e a vista
  `documento_folhas_estado` responde ao mesmo em SQL, para listagens.
- **Montar o manual inteiro:** folhas de abertura + corpo num só PDF, com o «Página X de Y» verdadeiro e o carimbo
  do `docs-pdf.js` por cima. É o passo seguinte natural, e é também o que torna a entrega à ANAC em papel e em
  digital (1.1.1.2) um botão em vez de uma tarde.
- **Folha de controlo de emenda do §1.5:** o quadro «EMENDAS AO MOA — AERÓDROMO INTL …», com número de folha de
  controlo e data, instruções de que páginas sair e entrar, e a assinatura de retorno. A migração 150 já guarda o
  número da folha de controlo; falta desenhá-la. Não estava nas nove pedidas.
