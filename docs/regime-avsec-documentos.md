# Regime AVSEC dos documentos — o que a lei exige e o que o portal passa a fazer

Escrito para: Marcio (decisor) e quem vier a operar o Portal de Documentos. Data: 2026-10-02.
Estado: código e migração escritos, **migração 158 não aplicada**.

Este documento cobre o regime próprio dos **programas de segurança da aviação** (AVSEC) — que não é o regime dos
manuais. O Manual de Operações do Aeroporto rege-se pelo Instrutivo 22C.107.001.A, já servido pela página das
Emendas (migração 150). O Programa de Segurança do Aeroporto rege-se por outro diploma, com exigências que nenhum
outro documento do portal tem.

## 1. As fontes, e como foram lidas

| Diploma | Aprovado por | Publicação | Onde o li |
|---|---|---|---|
| **Instrutivo n.º 32.039.001.A** — procedimento para a elaboração, implementação e controlo do **Programa de Segurança dos Aeroportos** | Despacho n.º 4442/25, de 9 de Junho | Diário da República, **II Série, n.º 108, de 12 de Junho de 2025**, pp. 6873 e segs. | PDF descarregado de `doc.anac.ao` (`share/s/ZjyC2_02Sq2iiv6DkaZTmA`), 18 páginas, texto extraído |
| **Instrutivo n.º 32.009.001.A** — procedimentos para a **disseminação dos regulamentos de segurança** (classificação da informação) | Despacho n.º 4450/25, de 9 de Junho | Mesmo Diário da República, pp. 6968–6970 | PDF descarregado de `doc.anac.ao` (`share/s/8QHCq2E7T_2hhHgNkHSNzA`), 5 páginas, texto extraído |
| **NTA 32** — Regulamento de Segurança da Aviação Civil | Despacho n.º **3604/25**, de 16 de Maio | — | **Não lido**: é documento reservado. A referência ao despacho é a que consta do próprio Instrutivo 32.009.001.A |

Tudo o que neste documento aparece entre « » é citação textual do diploma indicado.

### Três cuidados de citação, apurados ao ler os originais

1. **Cinco Instrutivos partilham o número 32.039.001.A** no mesmo Diário da República. O sumário da II Série
   n.º 108 mostra o 32.039.001.A aprovado pelo Despacho 4442/25 (aeroportos), outro pelo 4443/25 (operadores
   aéreos), outro pelo 4446/25 (provedores de serviços de navegação aérea) e outro pelo 4448/25 (actos de
   interferência ilícita nos serviços de tráfego aéreo). **O que rege o aeroporto é o do Despacho n.º 4442/25** —
   citar sempre o despacho a seguir ao número, em qualquer ofício para a ANAC.
2. O Instrutivo 32.009.001.A invoca o NTA 32 como aprovado pelo **Despacho n.º 3604/25, de 16 de Maio**. A
   pesquisa de mercado (`docs/pesquisa-mercado-ged.md`) dizia 3493/25; o texto publicado diz 3604/25. Corrigido
   aqui e no cabeçalho da migração.
3. **Erro de numeração no próprio Diário da República**: a secção da Formatação está impressa como «XII», que é
   também o número da secção da Preparação, imediatamente anterior. Pela posição (entre XII e XIV) é a **XIII**, e
   é assim que a cito. Numa citação formal, vale mais identificar a secção pelo nome («secção da Formatação») do
   que pelo número.

## 2. O que a lei exige

### 2.1. O programa é matéria classificada

Instrutivo **32.009.001.A, n.º 3**: as matérias classificadas «são distribuídos às entidades com necessidade de
saber, **mediante cópias controladas**». A lista do n.º 3 tem onze alíneas, e a **alínea b)** inclui os
«Programas de segurança de operadores aéreos e aeroportuários, programas de segurança relativos ao transporte de
correio e carga, ao catering, bem como os comentários, instruções e orientações pertinentes sobre o assunto».

Decisivo para o desenho: **o diploma não tem uma escala de níveis**. Não existe lá «confidencial < reservado <
secreto». Existe uma **lista de categorias** (alíneas a) a j)): plano nacional de gestão de crises, NTA 32,
programas de segurança, instruções e circulares classificadas, critérios de selecção no rastreio, planos de
contingência, especificações técnicas de equipamento de detecção, objectos de teste e parâmetros de calibração,
informação que revele vulnerabilidades, informação sensível sobre acidentes e interferência ilícita, e avaliação
da ameaça e do risco.

O **n.º 4, alínea b)**, acrescenta que as entidades a quem a matéria classificada é distribuída «ficam vinculados
ao dever de sigilo e devem assegurar o manuseio correcto e protecção dos mesmos contra o acesso não autorizado».

### 2.2. Lista de Páginas Efectivas

Instrutivo **32.039.001.A, secção XIII (Formatação), alínea k)**: o programa deve «Ter no início do volume, uma
"Lista de Páginas Efectivas" para actualização, cancelamento ou inserção de páginas, com as respectivas revisões
e datas de efectivação».

A alínea **j)** da mesma secção manda ter, também no início do volume, «uma folha separada para "Controlo de
Emendas"». A alínea **m)** manda que cada página leve «o indicador da numeração da página e do volume a que
pertence, a data de efectivação da página e o indicativo da empresa».

E a secção **XIV, n.º 2, alínea g)**, fecha o ciclo: ao receber uma revisão aprovada, o responsável faz a
distribuição e a substituição previstas, «inserindo ou cancelando as páginas afectadas e as respectivas anotações
na "Lista de Páginas Efectivas" e de "Controlo de Emendas" **de todos os volumes distribuídos aos usuários
credenciados do aeródromo**».

O Apêndice (I — Generalidades) fixa a ordem das primeiras páginas do volume: 1 folha de aprovação, 2 índice,
3 introdução, 4 controlo de emendas, **5 lista de páginas efectivas**, 6 lista de distribuição, 7 definições,
8 abreviaturas, 9 guarda e controlo do PSA, 10 elaboração e revisão periódica do PSA.

### 2.3. Conferência semestral

Instrutivo **32.039.001.A, secção XIV, n.º 2, alínea i)**: o responsável pela guarda e controlo deve «Estabelecer
**semestralmente** conferência e actualização de páginas com base na "Lista de Páginas Efectivas", a fim de
garantir que nenhuma página dos programas seja **retirada, inserida, modificada ou tenham alguma alteração
manuscrita**».

São **quatro achados nomeados**, e é por isso que no sistema são quatro colunas e não uma nota de texto livre: a
pergunta «quantas cópias tinham páginas manuscritas no segundo semestre?» tem de ter resposta sem ninguém ler
notas à mão.

A alínea **h)** acrescenta a «Substituição de folhas rasgadas, sujas ou com qualquer outra discrepância que
dificulte ou impossibilite a leitura».

### 2.4. Registo de credenciados e cópias controladas

Instrutivo **32.039.001.A, secção XIV**:

- **n.º 1** — o operador «deve designar e informar à Autoridade Nacional da Aviação Civil registando no programa
  de segurança o responsável pela guarda e controlo do programa, fornecendo o seu **nome completo, número de
  telefone, fax e correio electrónico**».
- **n.º 2, alínea a)** — apresentação de «2 (dois) exemplares completos do programa, em físico e em **formato
  digital não editável**», à ANAC, para aprovação.
- **n.º 2, alínea b)** — distribuição aos responsáveis pela guarda em cada aeródromo, à administração
  aeroportuária local e às demais entidades com responsabilidade na aplicação, «respeitando, contudo, o
  **princípio da necessidade de conhecimento**».
- **n.º 2, alínea c)** — «Guardar cópias dos programas em **local reservado com acesso controlado**».
- **n.º 2, alínea d)** — «**Manter actualizado o registo** dos empregados da empresa e de outras pessoas
  **credenciadas a possuir cópia** dos programas».
- **n.º 2, alínea e)** — «Disponibilizar cópias dos programas **apenas para os credenciados** citados na alínea
  anterior, bem como **apresentação por ocasião de inspecção**».
- **n.º 2, alínea j)** — «Garantir que o programa seja manuseado **somente por pessoas credenciadas pela empresa**
  e que estejam devidamente **autorizadas pelo responsável da empresa**».

### 2.5. Prazos e limiares que o regime impõe

| Exigência | Norma | Valor |
|---|---|---|
| Submeter a revisão à ANAC antes da entrada em vigor | XI, n.º 1 | **45 dias** («a menos que ANAC autorize um outro período») |
| ANAC aprova ou rejeita | XI, n.º 2 | 45 dias |
| Pedido de reapreciação de revisão não aprovada | XI, n.º 5 | 45 dias |
| Resposta a notificação de alteração (2 exemplares físicos revistos) | IX, n.º 4 | 30 dias |
| **Republicação total** do programa | XI, n.º 8 | revisões que alterem **mais de 40%** do texto |
| **Revisão total** do programa | XI, n.º 11 | **anualmente** |
| Conferência das cópias | XIV, n.º 2, alínea i) | **semestralmente** |
| Assinaturas do programa | IX, n.º 6 | **gestor máximo da empresa e gestor de segurança** |
| Operadores já em operação: submeter exemplar digital | XV, n.º 1 | 15 dias após a entrada em vigor do Instrutivo |

## 3. O que o sistema passa a fazer

Uma migração (`sql/158_regime_avsec.sql`), uma página (`/documentos/gestao/avsec`) e quatro componentes.

### 3.1. Classificação pela categoria da lei

`documento_classificacao_categoria` é semeada com **o texto das onze alíneas** do n.º 3 do Instrutivo
32.009.001.A, pelos seus números (`3.a.i`, `3.a.ii`, `3.b` … `3.j`). O documento ganha
`classificacao_categoria`, e `documento.classificado` é uma **coluna gerada**: é verdadeira exactamente quando há
categoria. Não há como um documento ficar classificado sem se dizer ao abrigo de que alínea, nem como alguém
inventar um nível que a lei não tem. O ecrã mostra o texto da alínea a quem classifica — ninguém escolhe bem
entre a alínea d) e a h) sem ler o que lá está escrito.

A coluna antiga `documento.nivel_confidencialidade` (que tinha «secreto» num documento, uma palavra sem regime
atrás) fica como está e deixa de contar para este efeito.

### 3.2. O regime vive numa tabela, não num sinalizador

`documento_avsec`, um registo por volume. A existência da linha é que põe o documento no regime — um booleano em
`documento` daria duas verdades para manter sincronizadas. Guarda:

- o **responsável pela guarda e controlo** com os quatro campos da secção XIV, n.º 1 (nome, telefone, **fax** —
  que a lei continua a pedir — e correio electrónico), mais a data em que a ANAC foi informada;
- o **local reservado de guarda** (alínea c));
- o volume e o seu título (secção XIII, alínea i));
- os **prazos e limiares da lei como valores por omissão**: 45 dias de submissão, 45 de resposta, 40% para
  republicação, 12 meses de revisão total, 6 meses de conferência. Quem abrir o ecrã encontra-os já lá, sem ter
  de ir procurar ao Diário da República.

A migração traz para o regime, de forma deliberadamente conservadora, **só os programas**: documentos com
`processo_codigo = 'PSA'` e `classe_codigo = 'PR'` (no acervo actual são quatro: o PSA do Namibe, o Plano de
Contingência, o Programa de Formação e Treino em Segurança e o Manual de Controlo de Qualidade de Segurança, de
Luanda). Os outros 38 documentos com «PSA» ou «AVSE» na numeração são fichas de registo, listas, matrizes e
plantas de terminal: aparecem no ecrã como **candidatos**, para serem trazidos um a um por quem sabe. Metê-los
todos no regime punha fichas de registo debaixo de regras que não são as delas e — pior — bloqueava a sua
distribuição a quem não estivesse credenciado.

### 3.3. Lista de Páginas Efectivas

`documento_lep` é uma **edição por revisão do volume**; `documento_lep_pagina` são as linhas, cada uma com a
página (texto, porque as páginas de um volume aeronáutico são «3-4» e «A-1», não números), o volume, o capítulo,
**a revisão da página**, **a data de efectivação** e a **acção** — `inserida`, `actualizada`, `cancelada`, que
são as três palavras da alínea k), mais `original` para o que veio na primeira edição.

- **Só uma edição emitida por documento**, garantido por índice único parcial na base de dados. Duas listas em
  vigor é o estado que a lei não admite, porque o detentor deixa de saber contra o que confere a sua cópia.
- **Emitir é uma função** (`documento_lep_emitir`): a nova entra em vigor e a anterior passa a substituída no
  mesmo instante. Fora de uma função, o índice único recusaria o primeiro dos dois passos.
- **Partir da revisão anterior** (`documento_lep_clonar`): a revisão 03 nasce com as páginas da 02, excepto as
  canceladas. Ninguém reescreve 200 linhas para mudar sete.
- **Colar de um Word ou de uma folha de cálculo**: o ecrã lê página/revisão/data separadas por tabulação, ponto e
  vírgula ou vírgula, e **mostra o que entendeu antes de gravar**, com as linhas sem data marcadas. Não rejeita
  nada à entrada — rejeitar faria a pessoa ir colar noutro sítio, que é o pior resultado possível.
- **Comparar duas edições** (`documento_lep_comparar`): devolve, página a página, o que entra, o que sai, o que é
  cancelado e o que é substituído. É a folha de trabalho da alínea g), e o PDF sai **só com o que muda** — uma
  folha com 200 linhas «nada» faz com que ninguém leia as sete que importam.
- **PDF da LPE** para ir no início do volume, com o aviso da conferência semestral e linha de assinatura do
  detentor; as páginas canceladas vão marcadas em vez de desaparecerem, porque o detentor tem de saber que
  aquela folha **saiu**.

### 3.4. Cópias controladas

`documento_copia_controlada`: número (nosso, consecutivo por documento, atribuído pelo servidor), detentor com
nome e cargo, entidade, aeroporto, **suporte** (`fisico` ou `digital`), local de guarda, **revisão que a cópia
tem na mão** e a edição da LPE que foi com ela, datas de entrega e de recepção, e o estado (`activa`,
`devolvida`, `extraviada`, `destruida`).

**A alínea e) é cumprida pelo servidor, não pelo formulário.** Um gatilho recusa registar uma cópia activa de
documento classificado em nome de quem não tenha credencial válida, com o âmbito certo, na data da entrega, e
devolve uma mensagem que diz o que fazer. Se a verificação estivesse no interface, bastava uma chamada directa ao
PostgREST para a contornar. O gatilho deixa passar as transições de saída (devolver, dar por extraviada,
destruir) mesmo depois de a credencial caducar: recolher uma cópia de quem já não está credenciado é
precisamente o que tem de poder acontecer.

O ecrã mostra, com o único aviso de largura total de toda a página, **as cópias activas em poder de quem já não
tem credencial válida** — o caso que o gatilho não cobre, porque a credencial caducou depois da entrega.

Sai em PDF a **Lista de Distribuição** (Apêndice, I — Generalidades, n.º 6) com coluna de assinatura de recepção:
o recebimento prova-se por assinatura, não por um campo numa base de dados.

### 3.5. Conferência semestral

`documento_conferencia_ciclo` (um por documento e semestre, com período fechado: 1 de Janeiro a 30 de Junho,
1 de Julho a 31 de Dezembro) e `documento_conferencia_item` (uma linha por cópia activa, com os **quatro achados
da lei** em quatro colunas booleanas, mais `nao_localizada`, que é nosso, e uma coluna `conforme` gerada).

- **Abrir** é idempotente (`documento_conferencia_abrir`): correr duas vezes não duplica nada e apanha as cópias
  entregues a meio do semestre, que é o caso real. `documentos_conferencias_abrir_semestre` abre de uma vez em
  todos os documentos do regime com cópias distribuídas, e serve tanto o botão do ecrã como o agendador.
- **Confirmar ≠ conferir.** São dois actos de duas pessoas, com dois instantes guardados: o detentor declara que
  tem a cópia e que ela confere; o responsável pela guarda confere página a página. Só o segundo é exigido pela
  lei.
- **Um achado sem páginas afectadas é recusado pelo servidor.** «Havia páginas modificadas» sem dizer quais não
  corrige nada, e a alínea g) manda anotar as páginas afectadas na LPE.
- **Fechar** marca os pendentes como `nao_conferida`, com linha no registo. Um ciclo que fechasse escondendo os
  pendentes seria pior do que não haver ciclo: dava aparência de conformidade.
- **O estado não se escreve à mão.** `authenticated` tem apenas SELECT nestas duas tabelas; abrir, confirmar,
  registar e fechar são funções `SECURITY DEFINER` que verificam quem é quem.

`documento_conferencia_registo` é **append-only**, no padrão da migração 149: escrito por gatilho a cada passo,
`authenticated` perde UPDATE e DELETE, e não existe na camada de dados do portal nenhuma função que o altere —
de propósito, e não por esquecimento. É ele, e não as colunas do item, que responde a «quem conferiu, quando, e o
que encontrou».

Sai em PDF a **folha de conferência** para imprimir e levar para junto do armário, com as quatro perguntas da lei
escritas e espaço para assinar: a conferência faz-se de pé, com o volume na mão.

### 3.6. Registo de credenciados

`documento_credenciado`: nome, correio electrónico, cargo, entidade, se é empregado da SGA ou «outra pessoa»
(a distinção é da alínea d)), **âmbito** (aeroporto e/ou programa — a tradução da necessidade de conhecimento
numa regra que o servidor sabe ler), datas de credenciação e validade, **quem autorizou** com o seu cargo
(alínea j)), a **necessidade de conhecimento escrita** (alínea b), coluna obrigatória), e a data em que o **dever
de sigilo** ficou documentado (Instrutivo 32.009.001.A, n.º 4, alínea b)).

- **Revoga-se, não se apaga.** `authenticated` não tem DELETE; a revogação é uma função que exige motivo escrito
  e devolve **quantas cópias essa pessoa ainda tem na mão**, que é a pergunta seguinte. Saber quem podia ter tido
  uma cópia há dois anos é metade de uma investigação de fuga.
- **A caducidade não espera por trabalho periódico**: lê-se da data (`documento_credenciado_estado`), por isso
  uma credencial fica caducada no instante em que o dia vira, mesmo que o agendador esteja parado.
- Uma credencial activa por pessoa, aeroporto e âmbito (índice único **parcial**, para as revogadas e suspensas
  ficarem).
- Sai em PDF o **registo de credenciados**, que é o que se apresenta numa inspecção (alínea e), segunda parte),
  com a necessidade de conhecimento de cada um por extenso.

### 3.7. Acesso

Nenhuma regra de acesso nova foi inventada: tudo se ancora em `doc_ctx()`, `pode_ver_documento()`,
`pode_editar_documento()`, `doc_gestor()` e `doc_email()` (migrações 136b/136c), com o padrão de subconsultas
`(SELECT …)` que o PostgreSQL avalia uma vez por instrução.

O que se acrescentou é o princípio da necessidade de conhecimento aplicado ao próprio registo: **o registo de
credenciados é ele mesmo sensível** — diz quem tem na mão os programas de segurança dos aeroportos do país. Não é
coisa de leitor: é de gestor, e de cada pessoa a sua própria linha. O mesmo para as cópias controladas, com o
detentor a ver as suas. A LPE, pelo contrário, vê-a quem vê o documento — a lista está no início do volume, e
quem tem o volume tem a lista.

## 4. Ficheiros

| Ficheiro | O que é |
|---|---|
| `C:\dirops\sga-onpremise\sql\158_regime_avsec.sql` | **Não aplicada.** Tabelas, RLS, gatilhos, funções e vistas. Idempotente, entre `BEGIN`/`COMMIT`, com `NOTIFY pgrst` e `SELECT` de verificação no fim |
| `src/documentos/apiAvsec.js` | Camada de dados: leituras, escritas e chamada das funções do servidor; tradução das recusas para português |
| `src/documentos/hooksAvsec.js` | Cache, cruzamento e contagens; `useRegimeAvsec()` devolve o regime todo já cruzado |
| `src/documentos/PortalAvsec.jsx` | A página: visão geral, e seis separadores com o estado no endereço |
| `src/documentos/components/avsec/ListaPaginasEfectivas.jsx` | Edições, páginas, colar, emitir, comparar |
| `src/documentos/components/avsec/CopiasControladas.jsx` | Entregar, devolver, extraviar, actualizar a revisão |
| `src/documentos/components/avsec/CiclosConferencia.jsx` | Ciclos, confirmação do detentor, registo da conferência, fecho, registo inviolável |
| `src/documentos/components/avsec/RegistoCredenciados.jsx` | Credenciar, revogar, dever de sigilo, caducidades |
| `src/documentos/components/avsec/pdfAvsec.js` | Os seis papéis em PDF nativo (jsPDF) e as exportações CSV |
| `src/documentos/components/avsec/pecas.jsx` | Selos, campos, citação da lei, números em destaque |

## 5. O que fica como pressuposto (a lei não é explícita)

Cada um destes está marcado no comentário da migração e, onde é visível, no próprio ecrã.

1. **Validade da credenciação.** O Instrutivo manda «manter actualizado o registo» (alínea d)) mas **não fixa
   prazo de validade** à credenciação de quem detém cópia. Os critérios de actualização e os prazos que o
   Apêndice descreve referem-se às **credenciais de identificação aeroportuária** (cartões de acesso às áreas
   restritas), que são outra coisa. A validade existe porque foi pedida; a predefinição são **24 meses**,
   afinável por documento, e a coluna aceita nulo (sem termo).
2. **Prazo para concluir a conferência do semestre.** A lei diz «semestralmente» e não dá prazo de conclusão.
   Pressuposto: o prazo é o **último dia do semestre conferido**, e pode ser mudado ciclo a ciclo.
3. **Fronteiras do semestre.** Janeiro–Junho e Julho–Dezembro. A lei não as define; sem datas fixas, «o primeiro
   semestre de 2026» não se audita.
4. **Confirmação do detentor.** A lei do PSA **não a exige** — o dever é do responsável pela guarda e controlo.
   Está no sistema porque é a única forma prática de conferir uma cópia que está noutro aeroporto, e é emprestada
   do regime dos manuais (Instrutivo 22C.107.001.A, Apêndice 1, §1.5, que dá 30 dias aos detentores do MOA para
   confirmarem por assinatura). Fica **separada** do acto de conferir, com nomes diferentes no ecrã.
5. **Numeração das cópias controladas.** A lei exige o registo dos detentores, não cópias numeradas. A numeração
   é nossa, e é o que permite dizer «falta a cópia n.º 4».
6. **O achado «cópia não localizada».** A lei nomeia quatro achados; este é o quinto, e é nosso. Está marcado
   como tal no próprio formulário de conferência.
7. **Guardar o registo da conferência.** A lei manda «estabelecer» a conferência e manda apresentar as cópias
   «por ocasião de inspecção» (alínea e)), mas não diz explicitamente que a conferência tem de ficar registada
   por escrito. Que uma conferência que não deixa rasto não se prova é inferência — razoável, e a razão de o
   registo ser append-only, mas inferência.
8. **Dever de sigilo = data, não assinatura.** O Instrutivo 32.009.001.A vincula ao dever de sigilo; o portal
   registra **a data em que isso ficou documentado** e como (termo assinado em papel, por exemplo). Não é
   assinatura electrónica — em Angola o nível avançado existe mas não está integrado aqui, e o qualificado não
   está maduro.
9. **Que documentos pertencem ao regime.** A lei fala do «programa de segurança» como um volume. Se os anexos
   (fichas de registo, plantas de terminal, listas de equipamento) são parte do volume para efeitos de LPE e de
   conferência é leitura que a SGA tem de fazer. A migração traz só a classe `PR`; o resto é decisão de pessoas,
   no ecrã. Note-se que a secção XIII, alínea l), **manda** que o programa contenha «as cópias das plantas de
   localização das instalações, dobradas em tamanho A4, podendo ser organizadas em volumes separados» — o que
   sugere que as plantas são parte do volume, e portanto do regime, mas em volume próprio.

## 6. O que fica por fazer

Por ordem do que mais falta:

1. **Aplicar a migração 158** e recarregar o esquema do PostgREST. Até lá a página mostra um aviso a dizer que o
   regime não está instalado, e o resto do portal não é afectado.
2. **Rota e menu** — `/documentos/gestao/avsec` em `DocumentosApp.jsx`, a entrada no `NAV_GESTAO` de
   `PortalLayout.jsx` e a chave de página `gestao_avsec` em `PAGINAS_PORTAL` (`src/lib/portalDocumentos.js`).
   A migração já acrescenta a chave aos perfis `gestor_documentos` e `admin_documentos` em
   `documentos_permissao`. (Deliberadamente fora deste trabalho.)
3. **Agendador** — ligar ao `dispatcher.mjs`: abrir os ciclos no início de cada semestre
   (`documentos_conferencias_abrir_semestre`) e avisar das credenciais a caducar
   (`documentos_credenciais_a_caducar`), na receita dos avisos que já existe
   (`scripts/relatorios/documentos-notificacoes.mjs`: um email por pessoa, nunca em cópia oculta, por causa do
   relay da SGA).
4. **Carimbo de página** (melhoria 2 da pesquisa de mercado) — a secção XIII, alínea m), manda que cada página
   leve a numeração da página e do volume, a data de efectivação **da página** e o indicativo da empresa. O
   carimbo vive no backend (`server.js`) e exige reinício do serviço; a LPE já guarda a revisão e a data de cada
   página, que é a informação que falta ao carimbo.
5. **As nove primeiras páginas na ordem do Apêndice** — folha de aprovação, índice, introdução, controlo de
   emendas, LPE, lista de distribuição, definições, abreviaturas, guarda e controlo, elaboração e revisão
   periódica. A LPE e a lista de distribuição já saem; as outras sete não.
6. **Percentagem de texto alterado**, para o limiar de 40% da secção XI, n.º 8, deixar de ser um número guardado
   e passar a ser medido. Com a pesquisa por página já indexada (migração 151) é possível; não é trivial.
7. **Formato digital não editável** para os dois exemplares da ANAC (secção XIV, n.º 2, alínea a)). Hoje o portal
   serve o ficheiro como está.
8. **Pedir o NTA 32 à ANAC**, formalmente e com credenciação. É documento reservado, e sem ele há partes do
   regime de segurança que só conhecemos por referência.
