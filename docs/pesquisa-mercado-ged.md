# Controlo documental: o mercado e nós

Pesquisa de mercado sobre software de gestão electrónica de documentos, feita em 2026-10-02 a pedido do dono, para
encontrar melhorias para o Portal de Documentos da SGA. Versão navegável publicada em
<https://claude.ai/artifact/62b1nN42H3noEevVR7oDsT>.

Quatro frentes de pesquisa: produtos de controlo documental da aviação, plataformas de gestão documental
generalistas, desenho de interface, e segurança e conformidade. Nove produtos analisados.

> **Actualizado em 2026-10-02, depois de o dono indicar <https://anac.ao/ao/legislacao-e-regulamentacao/>.**
> As exigências deixaram de ser inferidas da ICAO: estão agora citadas da lei angolana. Ver secção 3.

## 1. As cinco conclusões

1. **A lei angolana admite a distribuição em suporte digital e dá 30 dias para a confirmação.**
   Instrutivo 22C.111.001.A, 7.8.1.19: garantir o fácil acesso ao manual "impressas ou em suporte digital".
   Instrutivo 22C.107.001.A, Apêndice 1, 1.5: "Dentro de 30 dias de emissão de uma emenda, todos os detentores do
   MOA devem confirmar... através do retorno da página de controlo de emenda, assinada e datada". A confirmação de
   leitura que construímos é a peça que torna o portal admissível — e o prazo já não é escolha nossa.
2. **Nenhum líder do sector vende a aeroportos.** Web Manuals, Comply365 e Centrik servem companhias aéreas,
   manutenção e escolas de voo. Os aeroportos ficam com qualidade genérica (Q-Pulse) ou SMS de aeroporto (SMS Pro,
   ProDIGIQ), fracos na parte documental. Não há produto para copiar inteiro.
3. **Já ganhamos na retenção do registo de auditoria.** Microsoft 365: 180 dias (1 ano só em E5, 10 anos com
   add-on). Google Workspace: 6 meses. Box: 1 ano, e 2 semanas no feed em tempo real. Mitti: 7/30/180 dias.
   Q-Pulse e Ideagen: «pelo menos 12 meses». A plataforma é nossa: retenção ilimitada, de graça. É a linha que mais
   interessa a um inspector da ANAC.
4. **As aplicações móveis do sector são más.** DocuNet Viewer (Comply365, cliente BA e Emirates) tem 1,0/5 na App
   Store, com queixas de a página se mover sozinha dentro do avião.
5. **O que nos falta é cerimónia documental, não tecnologia:** data de entrada em vigor agendada, registo de
   emendas, carta de transmissão, marca de água na cópia impressa.

## 2. Mudanças de mercado a saber antes de falar com fornecedores

- Vistair e Comply365 são a mesma empresa desde Janeiro de 2024 (marca Comply365).
- ETQ chama-se agora Octave (comprada pela Hexagon, depois desmembrada).
- SafetyCulture passou a chamar-se Mitti em Agosto de 2026.
- Lufthansa NetLine/Ops não é controlo documental, é controlo de operações.

## 3. O que a lei angolana obriga

**Três correcções a premissas comuns:** o NTA 22A é o equivalente ao Anexo 14 (pistas, luzes) e **não** trata de
manuais; o que rege o MOA é o **NTA 22C** e sobretudo o **Instrutivo 22C.107.001.A** (DR II Série n.º 36, 24/02/2025);
e o **NTA 32 é documento reservado** (Despacho 3493/25), só obtível por pedido formal à ANAC.

### Manual de Operações do Aeroporto

| Exigência | Norma | Estado |
|---|---|---|
| Aprovação pelo PCA da ANAC | 22C.107.c) | falta |
| Ordem fixa das 9 primeiras páginas (capa, índice, declaração, lista de distribuição, registo de emendas…) | Instr. 1.1.2.2 | falta |
| Registo de Emendas com 7 colunas definidas, incl. **páginas afectadas** | Instr. Anexo 3 | falta |
| Lista de Distribuição com **assinatura de quem recebeu** | Instr. Anexo 2 | parcial |
| Detentores confirmam **em 30 dias**, por assinatura | Instr. Ap. 1, 1.5 | parcial |
| Rodapé em todas as páginas: revisão, ano, data de aprovação, página X de Y | Instr. 1.1.1.6 | falta |
| Emendas carecem de aprovação prévia da ANAC; **corrigendas não** | Instr. Ap. 1, 1.5 e 1.7 | falta |
| Verificação do manual **pelo menos uma vez por ano** | Instr. Ap. 1, 1.2 | falta |
| Pré-aviso de **14 dias** para alterações que afectem o AIP | Instr. 1.7.1.d) | falta |
| Todo o pessoal operacional com acesso às partes relevantes | Instr. Ap. 1, 1.2 | **temos** |
| Restrição de acesso permitida por razões de segurança ou gestão | Instr. Ap. 1, 1.3 | **temos** |
| Entrega à ANAC em papel **e** digital | Instr. 1.1.1.2 | falta |
| Formatação imposta: Arial 12, A4 | Instr. 1.1.1.1 e 1.1.2.1 | falta |
| Manual assinado pelo gestor responsável; declaração pelo director | Instr. 1.1.1.1 e Anexo 1 | falta |

### Programa de Segurança do Aeroporto (AVSEC) — **outro regime, não unificar**

Rege-se pelo Instrutivo 32.039.001.A (Despacho 4442/25) e pelo PNSAC (DP 86/25). Exige, ao contrário do MOA:
**Lista de Páginas Efectivas** no início do volume; **conferência semestral página a página** para detectar
alterações manuscritas; **republicação total acima de 40%** de conteúdo alterado; **revisão total anual**;
45 dias de antecedência para submeter revisões e 45 para a ANAC responder; **registo nominal dos credenciados**
a possuir cópia; guarda em local reservado; entrega em **formato digital não editável**; assinatura do gestor
máximo **e** do gestor de segurança. É **matéria classificada** (Instrutivo 32.009.001.A), com dever de sigilo —
o nosso sinalizador «secreto» tem de crescer para esquema de classificação com registo de credenciados.

### Retenção encontrada na lei

5 anos para relatórios de auditoria interna do SGSO (22C.113.d); 1 ano para fichas de inspecção (22C.609.b).
Para registos de formação em **aeroportos** não há prazo: os 5 anos de 22C.709 aplicam-se a **heliportos**.
Saída prática: fixar 5 anos no nosso Programa de Formação, que é aprovado pela ANAC.

**Confirmação de leitura ≠ assinatura de aprovação.** A primeira prova distribuição e recebimento (clique
autenticado com data/hora; prazo legal de 30 dias). A segunda prova autoridade sobre o conteúdo e exige assinatura
avançada, com nome, data, hora e **significado** do acto. Em Angola o nível avançado está disponível; o qualificado
não está maduro, e o regime está em revisão desde Julho de 2026.

## 4. Mesa posta do sector e a nossa posição

Das 12 funcionalidades que aparecem em quase todos os produtos sérios: **5 temos, 5 parciais, 2 não**.
Os dois «não» são **data de entrada em vigor agendada** e **leitura sem rede**; a ligação documento→formação também
falta, e é onde temos a maior vantagem possível por sermos donos da Universidade Corporativa.

Raridades que distinguem produtos: matriz requisito→parágrafo com aviso de alteração do regulamento (Web Manuals,
130+ bibliotecas), marca de água dinâmica no ficheiro descarregado (Veeva, Web Manuals), registo numerado de cópias
controladas com recolha automática (só Veeva), e documento que só entra em vigor quando a formação está concluída
(só MasterControl).

## 5. O nosso acervo, medido

217 documentos, 124 MB. 152 PDF (132 com camada de texto, 20 digitalizados sem texto), 51 Word, 14 Excel.
25 aeroportos da SGA; 19 com responsável nomeado, dos quais **14 sem conta no sistema**.

Consequências: 65 ficheiros (30%) não abrem na pré-visualização; 20 PDF colidem com a exigência de texto extraível;
a pesquisa ainda não entra no conteúdo, embora 132 ficheiros já tenham texto para indexar.

## 6. As doze melhorias, por ordem de valor

As quatro primeiras subiram ao topo depois de lermos os normativos: deixaram de ser boa prática e passaram a ser
**formato imposto por lei**.

Estado a **2026-10-03, 14:30**. Três colunas de estado são três coisas diferentes e vale a pena não as confundir:
**a funcionar** = está em produção e alguém o pode usar hoje; **construído** = o código e a migração existem em disco,
testados, mas nada foi aplicado nem publicado; **por fazer** = ainda não começou.

> A migração mais recente aplicada à base é a **163**. As migrações **156, 158, 159, 161, 164, 165 e 166 NÃO estão
> aplicadas**, e o `nginx/html` serve ainda o build de 02/10 às 20:11 — ou seja, todo o trabalho de interface de 03/10
> está em `src/` e não no browser. Verificado contra a base e contra o disco, não de memória.

| # | Melhoria | Referência | Esforço | Estado |
|---|---|---|---|---|
| 1 | Páginas iniciais, Registo de Emendas e Lista de Distribuição no formato legal | Instr. 22C.107.001.A, anexos 2 e 3 | 4 d | **construído** — registo de emendas a funcionar (migr 150); folhas legais em `docs-folhas.js` + migr **164**. A leitura do Instrutivo corrigiu-nos: a LEP é do regime do PSA, não do MOA, e 3 das 9 páginas legais são capítulos escritos à mão, não geráveis |
| 2 | Carimbo de página (revisão, data de aprovação, X de Y) + marca de água | Instr. 1.1.1.5 e 1.1.1.6 | 3 d | **a funcionar** (03/10) |
| 3 | Prazo de 30 dias nas confirmações, com quem falta e escalonamento | Instr. Ap. 1, 1.5 | 2 d | **construído** — migr **165** + `documentos-emendas.mjs` e `documentos-resumo-aeroporto.mjs`; ensaio seco corrido, zero emails enviados |
| 4 | Dois percursos: emenda (c/ ANAC) vs corrigenda (s/ aprovação) | Instr. Ap. 1, 1.5 e 1.7 | 2 d | **a funcionar** (migr 150) |
| 5 | Pré-visualização dos ficheiros Office | LibreOffice já instalado | 1 d | **a funcionar** (03/10) |
| 6 | Data de entrada em vigor agendada | Web Manuals, Veeva | 2 d | **a funcionar** (migr 152) |
| 7 | Registo de auditoria inviolável (revogar UPDATE/DELETE) | 21 CFR 11.10 | 10 min | **a funcionar** (migr 149) — reconfirmado a 03/10: nenhuma das 14 migrações seguintes devolveu UPDATE ou DELETE |
| 8 | Detecção de duplicados por SHA-256, com aba de pares | Paperless, Mayan | 0,5 d | **a meio** — impressões dos 217 calculadas (03/10); apareceram 10 grupos repetidos, estrutura na migr **166**; falta o ecrã de pares |
| 9 | Pesquisa dentro do conteúdo, **indexada por página** | ver aviso abaixo | 3 d (+2 OCR) | **a funcionar** (migr 151, 1612 páginas); OCR instalado e ensaiado, 13 digitalizados por indexar (~47 min) |
| 10 | Ligar documento ao curso na Universidade Corporativa | MasterControl, Comply365 | 4–5 d | **construído** — migr **159** |
| 11 | Acesso de auditor nominal, revogável e com registo | Ideagen, Veeva | 3 d | **a funcionar** (migr 155) |
| 12 | Política de retenção com autorização de eliminação | 22C.113.d) | 2 d | **a funcionar** (migr 153) |
| 13 | Regime próprio do PSA: LEP, conferência semestral, credenciados | Instr. 32.039.001.A | 4 d | **construído** — migr **158**, com o texto dos Instrutivos lido dos PDF do Diário da República |
| 14 | Matriz de conformidade requisito→parágrafo | Web Manuals | 10 d+ | **construído** — migr **159**, 7 diplomas e 31 requisitos semeados (por confirmar contra os originais) |
| 15 | Leitura sem rede | Comply365 | 10 d+ | **construído** — IndexedDB, sem service worker de propósito (um SW desarmaria em silêncio o aviso de versão nova) |

Fora desta lista, feito a 03/10 e **a funcionar**: fecho do buraco de autorização no storage (qualquer das ~102 contas
lia, substituía ou apagava qualquer ficheiro), quarentena em vez de apagar, registo das descargas por endereço
assinado, backup dos ficheiros do storage com manifesto diário, e os nomes dos 23 processos (migr 163).
**Construído e por ligar:** fluxo de aprovação (migr **156** + interface) e a codificação na interface (migr **161**).

### Feito fora desta lista, no mesmo dia

Trabalho que não estava na lista porque nasceu de coisas vistas pelo caminho:

- **Redesenho completo do portal**, 17 páginas, com direcção escrita em `desenho-portal-documentos.md`. Publicado às 18:50.
- **Dois defeitos de raiz que afectavam o DIROPS todo**: as janelas cortavam o conteúdo por falta de travão de largura, e a configuração do Tailwind apagava a escala de tipos de letra, pelo que `font-mono` não gerava CSS em 54 ficheiros — era por isso que os números de documento nunca alinhavam.
- **Classificação dos 217 documentos** pelo prefixo da própria numeração (migr 144): 72 formulários, 35 procedimentos, 19 manuais, 6 normas, 85 por classificar.
- **Lista de aeroportos própria e oficial** (migr 145/146): 23 aeroportos com IATA, cidade, província e director com telefone, com CRUD dentro do portal.
- **Coluna de portais autorizados** (migr 147/148): uma conta, uma senha, e uma coluna que diz onde cada pessoa pode entrar — com verificação no servidor, provada por ensaio.

**Aviso técnico decisivo para a pesquisa no conteúdo:** o `tsvector` do PostgreSQL tem **limite de 1 MB** por valor
(e 16.383 posições, 256 por lexema). Um manual digitalizado de 200 páginas passa-o. Indexar um `tsvector` por
documento **falha em silêncio ou trunca**. A forma correcta é **uma linha por página** (`documento_id`, `pagina`,
`tsvector`), agregando na consulta — o que de caminho dá «encontrado na página 47». Pipeline recomendado:
**OCRmyPDF + Tesseract** (`por`), que gera PDF/A e tem `--sidecar` para escrever o texto num ficheiro à parte.
Usar `unaccent` + stemmer `portuguese` + `websearch_to_tsquery`; `ts_headline` **tem de ser escapado** antes de ir
para HTML. Nota: 132 dos nossos PDF já têm camada de texto — extrair sem OCR é mais rápido e mais exacto.

Nota de desenho vinda das queixas reais de utilizadores: a confirmação tem de ser **por documento, nunca por pasta**
(queixa documentada da Web Manuals), e quem entra depois da emissão não deve receber pedidos de documentos antigos
(queixa da Web Manuals e da Mitti).

## 7. Desenho

Oito decisões: estado da tabela persistente ao recarregar (queixa documentada contra o SharePoint); pré-visualização
em painel lateral para triagem e página própria para leitura, **nunca modal**; pesquisa no endereço com sintaxe
campo:valor; âmbito da pesquisa declarado em texto; versão e data de vigor **na lista**, não só na ficha; um só aviso
de largura total em todo o produto, reservado à versão substituída (a habituação a avisos banais transfere-se para o
aviso que importa — *The Fog of Warnings*, SOUPS 2019); modo claro por omissão com contraste alto (ao sol o contraste
efectivo cai para ~2:1); alvos de toque de 48 px, mais com luvas.

## 8. O que não construir

Impedir captura de ecrã (impossível no navegador; existe sempre o telemóvel). Desactivar botão direito e atalhos.
Vender `bloquear_download` como segurança (vale como higiene de versões, não como confidencialidade). Marca de água
como barreira (é responsabilização, não protecção). Inspecção pesada de tráfego. Cadeia de blocos para o registo de
auditoria (uma cadeia de hashes assinada dá o mesmo por uma fracção do custo).

**E quatro que o mercado vende como essenciais e quase ninguém usa:** desenhador gráfico de fluxos (a AIIM diz que
workflow é historicamente subutilizado; o que se usa é aprovar/devolver, que já temos); comparação visual entre
versões (o Nextcloud não a tem, o DocuWare diz para abrir as duas e olhar — 20 anos de concorrência não a
construíram porque ninguém a abre); assinatura electrónica própria (integra-se, não se constrói: fazer fácil é
desenhar com o rato, a assinatura mais fraca que existe); edição conjunta em tempo real (o programa WOPI da
Microsoft **não está aberto a clientes finais**, e as alternativas livres avisam que não são para produção).

A corrigir, não construir: 22% das partilhas externas no mundo real usam links abertos e 94% desses estão inactivos
mas continuam a funcionar (Valence Security). Já temos validade obrigatória e revogação; falta revisão periódica dos
links vivos.

**Crítica ao que temos:** a `BuscaInteligente.jsx` faz um `includes()` no cliente sobre título, descrição e
categoria dos documentos já carregados. Não é inteligente nem procura dentro dos ficheiros. Corrigir o nome.

**Ideias de desenho a roubar do código aberto:** o `sys:incomplete` do Alfresco (não bloquear o carregamento por
falta de metadados obrigatórios; marcar como incompleto e tornar isso **pesquisável**, virando uma lista de
trabalho); as tags *restricted*/*invisible* do Nextcloud (o utilizador não as vê nem as pode remover — é como se
compra uma política de retenção sem módulo de registos); a impressão como **permissão separada** da visualização e
da descarga (Mayan); e as transformações e redacções **não destrutivas**, aplicadas na renderização, com permissão
dedicada para ver por baixo da redacção (Mayan).

## 9. Custo da alternativa

Web Manuals: €4.000/ano na entrada (5 leitores, 2 editores); profissional €170/editor/mês + €3,25/leitor/mês com
contrato de 3 anos; biblioteca de conformidade €50–60/mês. Mitti $24/pessoa/mês. MasterControl desde $25.000/ano
(formação é escalão acima), mediana real $115.673. Veeva Vault, mediana de contratos reais $188.460/ano.

**Para a SGA:** 5 editores + 100 leitores no plano profissional da Web Manuals ≈ **€14.000/ano**, 3 anos de
compromisso, sem biblioteca de conformidade. É o valor contra o qual a plataforma própria deve ser julgada.

## 10. Sequência proposta

- **Primeira onda (~1 semana):** pré-visualização Office, data de entrada em vigor agendada, marca de água na
  descarga, registo de auditoria inviolável.
- **Segunda onda (~2 semanas):** registo de emendas e carta de transmissão, prazo e escalonamento das confirmações,
  pesquisa no conteúdo, política de retenção, acesso nominal de auditor. No fim cumprimos a mesa posta inteira,
  menos a leitura sem rede.
- **Terceira onda (por decidir):** ligação à Universidade Corporativa (a que mais nos distingue), matriz de
  conformidade, leitura sem rede.
- **Acção que não é de software:** convidar os 14 responsáveis de aeroporto sem conta. Sem eles a aprovação por
  responsável de aeroporto existe só no código.

## 11. Limites da pesquisa e o que perguntar à ANAC

- **NTA 32** (Regulamento de Segurança Aérea) é **reservado**: pedido formal à ANAC, com credenciação.
- O **Instrutivo 22C.105.001.B** remete para prazos de emenda ao MOA que **não chega a apresentar** (a secção 6.9
  diz que os prazos são «apenas indicativos»). Perguntar à DAIA qual o prazo aplicável.
- **Retenção de registos de formação** em aeroportos certificados: sem prazo na lei. Fixar no nosso Programa de
  Formação (que a ANAC aprova) ou perguntar.
- **Instrutivo 22C.115.001.A** (formação do pessoal operacional): o PDF não permitiu extracção; abrir à mão.
- A página «Certificação de Aeródromos» da ANAC continua «em desenvolvimento»; os «Manuais» (id=98) também.
- **Incoerências de numeração na própria ANAC:** cinco instrutivos partilham o número 32.039.001.A; e o Instrutivo
  32.009.001.A cita o NTA 32 como aprovado pelo Despacho 3604/25 quando é o 3493/25. Confirmar antes de citar em
  documentos oficiais da SGA.
- G2, TrustRadius e Reddit recusam acesso automatizado — nenhuma citação vem de lá. A documentação da MasterControl
  e da Octave é fechada a clientes. Os preços da Comply365 e da Q-Pulse não são públicos.

### Endereços dos normativos (guardar cópia)

- Instrutivo 22C.107.001.A (MOA) — `https://doc.anac.ao/share/s/IxVwodDQR1ujl8yFUXevoQ`
- Instrutivo 32.039.001.A (PSA) — `https://doc.anac.ao/share/s/ZjyC2_02Sq2iiv6DkaZTmA`
- Instrutivo 22C.111.001.A (SGSO) — `https://anac.ao/fotos/frontend_2/editor2/INSTRUTIVOS/instrutivo_22c_111_001_a-sistema_de_gestao_de_seguranca_operacional_para_aerodromos.pdf`
- Instrutivo 32.009.001.A (disseminação/classificação) — `https://doc.anac.ao/share/s/8QHCq2E7T_2hhHgNkHSNzA`
- Instrutivo 22C.105.001.B (certificação) — `https://doc.anac.ao/share/s/WlpNEMKpRfC8Z98sc7RRLg`
- NTA 22C — `https://anac.ao/fotos/frontend_2/editor2/LEIS/nta_22c-processos_e_obrigacoes_aplicaveis_aos_operadores_de_aerodromos_e_heliportos_e_nas_suas_zonas_circundantes_de_proteccao.pdf`

Os endereços `doc.anac.ao/share/s/<ID>` são páginas, não ficheiros. O PDF descarrega-se em
`https://doc.anac.ao/share/proxy/alfresco-noauth/api/internal/shared/node/<ID>/content/ficheiro.pdf?a=true`
(no servidor, com `curl.exe -sSL --ssl-no-revoke`; o curl do Git Bash não resolve DNS).
