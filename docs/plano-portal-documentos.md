# Plano — Portal de Documentos SGA (GED autónomo)

Escrito para: Marcio (decisor) e quem vier a desenvolver/operar o portal. Data: 2026-10-02. Estado: proposta, por aprovar.

## 1. Objectivo

Separar a gestão electrónica de documentos do DIROPS, como foi feito com a formação: um site próprio em `http://10.1.65.45/documentos`, com moldura, perfis, controlo de acesso e auditoria próprios, pensado para **manuais dos aeroportos, procedimentos e normas**, com download controlado e links temporários para terceiros (ANAC, auditores, fornecedores). O DIROPS fica só com uma ligação no menu; os documentos operacionais de voo (anexos das operações) ficam no DIROPS.

## 2. O que existe hoje (resumo do inventário)

- Uma página única `Documentos` (pastas, filtros, modais), `HistoricoAcessoDocumentos`, 12 componentes em `src/components/documentos`.
- Tabelas `documento`, `pasta`, `documento_link_partilha`, `log_acesso_documento`. Sem versões, sem workflow, sem lixeira própria, datas em texto, `documento.aeroporto` em texto (ICAO ou UUID).
- Links públicos já funcionais: `/s/<token>` (documento), `/p/<token>` (pasta), `/v/<token>` (selecção), com validade, password, limite de downloads, revogação, rate-limit e auditoria; publicados pelo túnel Cloudflare em `docs.marciosager.com`.
- Relatório agendado «documentos a expirar» (dispatcher, email aos administradores).
- **Lacuna grave**: os ficheiros estão em storage **público** (`/storage/v1/object/public/uploads/...`), sem autenticação. Os perfis `nivel_acesso[]`, as senhas de pasta/documento e o bloqueio de download são verificados só no cliente. Qualquer autenticado vê a árvore inteira de pastas.

## 3. Princípios

1. **Segurança primeiro**: nenhum ficheiro servido sem verificação no servidor; todas as regras de acesso em RLS/backend, nunca só na interface.
2. **Mesma receita da Universidade**: prefixo próprio, moldura própria, perfis próprios em `users.perfis`, página pública de entrada, pedido de acesso/convite, auditoria filtrada ao módulo, documentação e memória.
3. **Dados primeiro, ecrãs depois**: sanear o modelo antes de construir o portal, para não migrar duas vezes.
4. **Compatibilidade**: links `/s/`, `/p/`, `/v/` e os ficheiros já partilhados continuam a funcionar durante a transição.

## 4. Fases

### Fase 0 — Decisões (Marcio)
- Nome e URL: proposta «Documentos SGA» em `/documentos`.
- Identidade: começar com o login do DIROPS (fase 1) e, se se justificar, base de contas própria depois (a receita `auth_uc`, clone de contas, prefixo nginx e flag de build já existe e demora ~1 dia).
- Perfis do portal: `leitor_documentos` (consulta), `editor_documentos` (carrega/edita nas pastas que gere), `gestor_documentos` (aprova, publica, gere pastas, permissões e links), `admin_documentos` (tudo + configurações). O perfil global do dono continua a ver tudo.
- Documentos de voo (anexos das operações): ficam no DIROPS.
- Quem aprova documentos e se a aprovação é obrigatória por tipo (manual sim, formulário não).
- Retenção: quanto tempo ficam na lixeira e no arquivo morto; purga de links e de registos de acesso.
- Marca de água real no PDF e OCR para pesquisa: sim/não (têm custo de processamento no servidor).

### Fase 1 — Saneamento do modelo de dados (1–2 dias)
- `documento`: `aeroporto_id uuid` (migrar de ICAO/UUID em texto), `data_publicacao`/`data_expiracao` em `date`, `deleted_at` (lixeira própria), `tipo_id` (tabela `documento_tipo` editável: manual, procedimento, instrução, norma, formulário, relatório…), `numero` (ex.: IT-DIVOPAT-001), `entidade_emissora`, `estado` (rascunho, em revisão, aprovado, em vigor, obsoleto), `em_vigor_desde`, `responsavel_email`, `tags[]`, `pesquisa tsvector` (texto integral: título, descrição, número, tags e, se houver OCR, conteúdo).
- `documento_versao`: histórico de ficheiros (versão, ficheiro, quem, quando, nota de alteração, aprovado por); a «versão em vigor» é a última aprovada.
- `pasta`: `empresa_id`, `deleted_at`, permissões próprias (ver fase 2), herança para subpastas.
- `log_acesso_documento`: uma só coluna de IP; separar os registos de validação de certificados para `log_auditoria`.
- Storage: todos os ficheiros passam a **privados** (`private-uploads`), servidos pelo backend com URL assinada de curta duração e registo de acesso; migrar os 1016 ficheiros e reescrever `arquivo_url`.

### Fase 2 — Controlo de acesso no servidor (2 dias)
- Permissões por pasta, herdadas pelas subpastas: perfis permitidos, aeroportos permitidos, utilizadores explícitos; documento pode restringir ainda mais.
- Função SQL `pode_ver_documento(id)` / `pode_editar_documento(id)` usadas em RLS de `documento`, `documento_versao`, `pasta` e nos downloads do backend.
- Senhas de pasta/documento validadas no backend (nunca enviar o hash ao cliente).
- `bloquear_download` real: só visualização em viewer (PDF renderizado no browser a partir de URL assinada de leitura, sem link directo); marca de água no servidor se aprovado na fase 0.
- Auditoria: `log_acesso_documento` para visualizar/descarregar/partilhar; `log_auditoria` (módulo «Documentos») para criar/editar/aprovar/apagar/permissões.

### Fase 3 — Portal `/documentos` (4–5 dias)
- Moldura própria (como `PortalLayout`), entrada pública (login, pedido de acesso, convite, recuperar senha), página de privacidade, `document.title` e rodapé próprios.
- Páginas de consulta: **Início** (novidades, documentos em vigor recentes, por aeroporto), **Biblioteca** (aeroporto → pastas → documentos; filtros por tipo, estado, validade), **Pesquisa** (texto integral), **Documento** (viewer, metadados, versões, «li e tomei conhecimento», histórico de acessos para gestores), **A minha conta**.
- Páginas de gestão: **Carregar** (individual e em massa, com sugestão de tipo), **Pastas e permissões**, **Aprovações** (fila de revisão/aprovação), **Validades** (a expirar/expirados, com renovação), **Partilhas** (links activos/expirados/revogados, criar, revogar, acessos externos), **Auditoria**, **Relatórios** (acessos, leituras confirmadas, validade), **Configurações** (tipos, emails, textos, retenção).
- Reaproveitar os componentes actuais (viewer, upload em massa, modais de partilha) adaptados à moldura nova; `Documentos.jsx` e `HistoricoAcessoDocumentos.jsx` saem do DIROPS e passam a redireccionar.

### Fase 4 — Links temporários e acesso externo (1 dia)
- Página pública de partilha com a marca SGA e página «link expirado/revogado» própria.
- Melhorias: pré-visualização sem download quando `bloquear_download`, aviso por email ao criador quando o link é usado, limite por IP, lista de IPs/datas de acesso no dashboard.
- Confirmar e alinhar o Path publicado na Cloudflare (`^/(s|p|v|cert)/`) com o nginx (acção do administrador).

### Fase 5 — Workflow e confirmação de leitura (2 dias)
- Estados rascunho → em revisão → aprovado → em vigor → obsoleto, com quem/quando; versão nova volta a revisão sem tirar a anterior de vigor.
- «Li e tomei conhecimento» por colaborador e documento, com relatório por aeroporto/perfil (mesma lógica dos relatórios da Universidade).
- Notificações (dispatcher já existente): documento novo em vigor para o seu aeroporto, revisão pendente, validade a expirar, leitura por confirmar.

### Fase 6 — Migração e corte (1–2 dias)
- Migrar dados e ficheiros, validar links antigos, testar com dois aeroportos piloto e os gestores.
- DIROPS: grupo «Documentos» no menu passa a ligação para o portal; rotas antigas redireccionam; perfis `Documentos`/`HistoricoAcessoDocumentos` deixam de dar páginas no DIROPS.
- Documentação, memória, formação de 30 min aos gestores.

## 5. Estimativa e sequência

| Fase | Esforço | Depende de |
|---|---|---|
| 0 Decisões | reunião | — |
| 1 Dados + ficheiros privados | 1–2 dias | 0 |
| 2 Acesso no servidor | 2 dias | 1 |
| 3 Portal | 4–5 dias | 1, 2 |
| 4 Links e externos | 1 dia | 3 |
| 5 Workflow e leitura | 2 dias | 3 |
| 6 Migração e corte | 1–2 dias | tudo |

Cerca de duas semanas de desenvolvimento efectivo, com testes do Marcio entre fases. As fases 1 e 2 valem a pena mesmo sem o portal, porque fecham a exposição actual dos ficheiros.

## 6. Riscos e cuidados

- Ficheiros públicos hoje: quem tiver um URL antigo continua a aceder até à migração para storage privado; fazer a fase 1 cedo.
- Links já enviados a terceiros apontam para `docs.marciosager.com/s|p|v/...`: manter as rotas.
- O túnel só publica os caminhos configurados na Cloudflare; alterações exigem o administrador.
- Pesquisa em texto integral com OCR aumenta a carga do servidor (já saturado pelo Check Point); fazer OCR em segundo plano e fora do horário.
- Identidade própria (base de contas separada) só se houver utilizadores que não devam existir no DIROPS; caso contrário é complexidade sem ganho.

## 7. Estado de execução (2026-10-02)

### Fase 1 — feita
- `sql/135_documentos_modelo.sql` aplicada: `documento_tipo` (semente), colunas novas em `documento` (`tipo_id`, `aeroporto_id`, `numero`, `entidade_emissora`, `estado`, `publicacao_em`, `expira_em`, `em_vigor_desde`, `responsavel_email`, `aprovado_por/em`, `tags`, `deleted_at/by`, `versao_atual`), `pesquisa` tsvector + GIN, `documento_versao` (v1 semeada para os 217), permissões próprias em `pasta` (`perfis_permitidos`, `aeroportos_permitidos`, `emails_permitidos`, `herdar_permissoes`, `deleted_at`), `documento_leitura`, `documentos_aeroporto_responsavel` (19, de `relatorio_destinatario`), `documentos_acesso_aeroporto` (448, de `users.aeroportos_acesso`), `documentos_config`.
- Ecrãs actuais do GED compatíveis com ficheiros privados (URL assinada no viewer e nos downloads; documentos novos privados por omissão) — publicado 11:25.
- Backend patch 24 (links `/s` `/p` `/v` resolvem `private-uploads`) aplicado em `server.js` — **pendente `Restart-Service dirops-functions-v2`**.
- `scripts/documentos/mover-ficheiros-privados.mjs` (`--dry` testado: 217 ficheiros, 0 em falta). Correr **só depois** do restart; é idempotente.

### Fase 2 — feita
- `sql/136a_documentos_perfis.sql`: perfis `leitor_documentos`, `editor_documentos`, `gestor_documentos`, `admin_documentos` em `regra_permissao` **sem páginas do DIROPS**; sementes: 102 leitores (todos os activos), 4 gestores (responsáveis de aeroporto com conta), 11 administradores.
- `sql/136b_documentos_rls.sql`: funções `doc_admin/doc_gestor/doc_editor/doc_membro`, `doc_meus_aeroportos` (membro + responsável), `pasta_permissoes_efetivas` (herança), `pode_ver_pasta`, `pode_ver_documento`, `pode_editar_documento`; políticas RLS novas em `documento`, `pasta`, `documento_versao`, `documento_leitura`, `documentos_acesso_aeroporto`, `documentos_aeroporto_responsavel`, `documento_link_partilha` (secretos nunca), `log_acesso_documento`. A coluna antiga `documento.nivel_acesso` (perfis do DIROPS, «visualizador» em todos) deixou de contar. Documentos de voo (`voo_ligado_id`) mantêm a regra por empresa.
- Teste por simulação de JWT: leitor do FNMO vê 31 pastas / 217 documentos e não edita; leitor de outro aeroporto vê 0; utilizador sem aeroportos vê 0; `anon` vê 0; administrador vê tudo.
- Login do DIROPS (`src/pages/Login.jsx` + `src/lib/portalDocumentos.js`): perfis de documentos contam como perfis de portal — quem só tem perfis de portal não entra no DIROPS (Universidade se tiver perfis da UC, senão `/documentos`).

### Factos apurados
- Todo o GED actual é do FNMO (31 pastas, 215 documentos + 2 sem aeroporto); só o dono carregou documentos → apertar carregamentos a editores não afecta ninguém.
- 14 dos 19 responsáveis de aeroporto não têm conta → terão de ser convidados no portal.
- Senhas: 1 pasta; `bloquear_download`: 1 documento; links partilháveis activos: 2 (14 no total).

### Fica para a fase 3 (portal)
Validação de senhas de pasta/documento no backend, `bloquear_download` real (viewer sem link directo), auditoria de criar/editar/aprovar em `log_auditoria`, páginas do portal e login isolado (receita `auth_uc`: schema `auth_docs`, GoTrue próprio, clone de contas, prefixo nginx, flag de build).

### Desempenho (migração 136c)
A primeira versão das regras (136b) chamava funções encadeadas por linha (~25 consultas por documento): listar 217 documentos levava **740 ms** e cresceria linearmente. A 136c mantém as mesmas regras mas calcula o contexto do utilizador (`doc_ctx`: email, perfis, aeroportos, níveis) e as pastas visíveis **uma vez por consulta**, com subconsultas que o Postgres avalia como InitPlan:

| Consulta | 136b | 136c |
|---|---|---|
| 50 documentos mais recentes | 742 ms | 18 ms |
| contagem de documentos | 733 ms | 7 ms |
| lista de pastas | 50 ms | 3 ms |

### Como testar o acesso
- `scripts/documentos/teste-acesso-documentos.sql` — simula leitor do aeroporto, leitor de outro aeroporto, gestor, administrador e sessão anónima dentro de uma transacção revertida; 13/13 conformes.
- Verificação ponta-a-ponta pelo PostgREST (JWT assinado como a aplicação): 11/11 conformes — administrador 217 documentos/31 pastas, leitor do FNMO o mesmo, leitor de outro aeroporto 0, sem aeroportos 0, leitor a criar documento ou pasta recebe HTTP 403, anónimo 0.

### Corte para ficheiros privados — FEITO (2026-10-02, 12:08–12:30)
O dono reiniciou `dirops-functions-v2` (patches 18–24 carregados) e os 217 ficheiros do GED passaram para o bucket privado com `scripts/documentos/mover-ficheiros-privados.mjs`: 217 movidos, 0 erros, 0 em falta. Ficaram 799 ficheiros públicos, que pertencem a outras entidades (fotos, proformas, anexos de voo) e não ao GED.

Verificado depois do corte:
- URL público antigo de um documento → **HTTP 404**: deixou de servir o ficheiro a quem tenha o endereço.
- Assinar e descarregar pela aplicação → HTTP 200, PDF de 838 KB.
- Links partilháveis activos (dois, de selecção, rota `/v/`) → HTTP 200; descarga de um ficheiro de dentro do link → HTTP 200, PDF de 478 KB, de 216 listados. Links expirados continuam a devolver 410. O outro link activo aponta para a pasta «AN.02.PLANO CURRICULAR», que está vazia desde antes da migração.

Também fechado nesta passagem: os carregamentos por arrastar-e-largar (`DragDropUpload`) e em massa (`UploadMassaModal`) gravavam no bucket público, pelo que documentos novos voltariam a ficar expostos; passam a gravar em privado como já fazia o formulário. A exportação da biblioteca deixou de exportar ligações que já não abrem.

## 8. Fase 3 — Portal `/documentos` (em curso, 2026-10-02)

Decisão do dono: **a entrada «Documentos» fica no menu do DIROPS** e abre o portal (ao contrário da formação, que foi
escondida). Quem consulta manuais trabalha no DIROPS todos os dias, por isso tirar a entrada do menu só criaria atrito.
As rotas antigas passam a reencaminhar, preservando o que vem depois do endereço, como `/Formacao` já faz.

### Base já assente
- `src/lib/portalDocumentos.js` — perfis, níveis (administrador ⊃ gestor ⊃ editor ⊃ leitor), páginas do portal,
  permissões predefinidas, estados do documento, validade. 16 testes em `src/lib/__tests__/portalDocumentos.test.js`.
- `src/documentos/hooks.js` e `api.js` — camada de dados do portal (configuração, permissões, pastas, documentos,
  versões, pesquisa, leituras, acessos, auditoria, links).
- `src/documentos/DocumentosApp.jsx` — rotas do portal.
- `src/App.jsx` — `/documentos/login`, `/pedir-acesso`, `/recuperar`, `/alterar-senha`, `/privacidade`,
  `/convite/:token` e `/documentos/*`.
- `src/lib/supabaseClient.js` — `/documentos` é portal próprio: sessão em chave separada (`sb-documentos-auth`) e,
  quando compilado com `VITE_GD_ISOLADO=1`, base de contas isolada atrás do prefixo `/gd` do nginx.
- `sql/140_documentos_permissao.sql` — páginas visíveis por perfil, afináveis na gestão (aplicada).

### Nomes fixados para o login isolado
Schema `auth_docs`; GoTrue na porta 9997, serviço `dirops-auth-docs-v2`; prefixo nginx `/gd`; bandeira de compilação
`VITE_GD_ISOLADO`; interruptor `documentos_config.auth_isolada`. O portal funciona **antes** da activação do login
isolado (com `VITE_GD_ISOLADO=0` usa as contas do DIROPS), o que permite testá-lo sem esperar pelo serviço novo.

### Avisos por email (parte da fase 5, já feita)
- `scripts/relatorios/documentos-notificacoes.mjs` — um email por pessoa, só com o que lhe diz respeito nos seus
  aeroportos: documentos novos em vigor, leituras por confirmar, documentos à espera da sua aprovação (responsáveis
  de aeroporto e gestores) e validade a terminar. Quem não tem nada não recebe nada. Um email por destinatário, nunca
  em cópia oculta, por causa do relay da SGA.
- Registado no agendador (`dispatcher.mjs`) e na página Relatórios Automáticos, no cartão «Documentos», que junta
  este aviso ao relatório de validade já existente. A agenda foi criada **desligada** (diária, 07:30): o dono liga-a
  quando o portal entrar em uso.
- `sql/141_documentos_exige_leitura.sql` — a confirmação de leitura passa a ser uma marca explícita por documento
  (`exige_leitura`, com `leitura_perfis` e `leitura_prazo_dias`), em vez de uma regra automática. Sem isto, a primeira
  execução teria pedido confirmação de 25 documentos a 21 pessoas de uma vez. Por omissão nenhum documento exige.

## 9. Fases 4 a 6 (2026-10-02)

### Rasto do percurso de aprovação (fase 5)
`sql/143_documentos_historico_estado.sql` — tabela `documento_estado_historico` alimentada por **gatilho**: cada
mudança de estado (rascunho → em revisão → aprovado → em vigor → obsoleto), a ida para a lixeira e o regresso ficam
registados com quem, quando e que versão. Não depende de o interface se lembrar de gravar. As colunas
`aprovado_por`/`aprovado_em` só guardam a última aprovação; numa auditoria da ANAC a pergunta é sempre o percurso
completo. Os 217 documentos entraram com o estado actual como ponto de partida. Testado com transacção revertida:
quatro passos gravados na ordem certa, com o email de quem fez cada um.

### Entrada no menu do DIROPS (fase 6)
`src/Layout.jsx` — a entrada «Documentos» passa a abrir o portal, com `externo: true`, o que força um carregamento
completo da página. É obrigatório: a sessão de cada portal vive numa chave própria escolhida no arranque, por isso
uma navegação interna levaria a sessão errada.

A página antiga do GED **continua a responder no seu endereço** como rede de segurança, até o dono confirmar que o
portal faz tudo o que precisa. O reencaminhamento de `/Documentos` para `/documentos` é o último passo do corte, e
fica para quando essa confirmação existir. A entrada «Histórico de acessos» também fica onde está até a página de
auditoria do portal estar verificada.

### Portal publicado (2026-10-02, 13:43)
Dezanove ficheiros novos em `src/documentos/`: moldura, entrada, privacidade, seis páginas de consulta (Início,
Biblioteca, Pesquisa, Documento, As minhas leituras, Conta) e oito de gestão (Painel, Documentos, Pastas, Links,
Acessos, Auditoria, Relatórios, Configurações). Identidade azul-petróleo, para não se confundir com o violeta da
Universidade. Nada do DIROPS aparece lá dentro.

Verificado depois de publicar: 360 testes passam, `/documentos`, `/documentos/login`, `/documentos/biblioteca` e
`/documentos/gestao` respondem, e as 15 consultas de que as páginas dependem respondem bem para o administrador e
para um leitor, com o âmbito certo (o leitor vê as pastas e documentos do seu aeroporto, nenhum link partilhável e
nenhum registo de acessos alheio).

Migrações aplicadas nesta ronda: 140 (páginas por perfil), 141 (confirmação de leitura explícita), 142 (pedidos de
acesso e convites), 143 (histórico de estados). As 137, 138 e 139 ficam à espera da activação do login isolado.

**Falta reiniciar o backend.** O patch 25 do `server.js` (pedidos de acesso, convites, perfis, validação de senhas no
servidor, bloqueio de descarga real) foi escrito às 12:44, depois do reinício das 12:08. Sem novo
`Restart-Service dirops-functions-v2`, as páginas de Acessos mostram o aviso de serviço indisponível; o resto do
portal funciona, porque fala directamente com a base de dados.

### Backend em produção (2026-10-02, 13:51)
O dono reiniciou o `dirops-functions-v2` e o patch 25 está activo. Verificado: o serviço responde `patch 25`;
«listar acessos» devolve os 102 utilizadores a um administrador e é recusado (403) a um leitor comum; a conta global
não pode ser revogada (403); e uma tentativa de senha numa pasta marcada como protegida mas sem senha definida é
recusada com 409 e uma mensagem a pedir que um gestor a defina. Os ficheiros privados, as ligações assinadas e os
links partilháveis continuam a servir bem com o backend novo.

Fica por fazer, quando o dono quiser: activar o login isolado (`scripts/activar-documentos-isolado.ps1`, que instala
o serviço do GoTrue, troca o `nginx.conf` e reinicia o nginx) e, depois de o portal estar validado no dia-a-dia,
reencaminhar `/Documentos` para `/documentos` e tirar a entrada «Histórico de acessos» do menu do DIROPS.

## 10. Independência total e lista oficial de aeroportos (2026-10-02)

Decisão do dono: o portal passa a ser independente também nos aeroportos e nos responsáveis, com gestão própria lá
dentro, e o login isolado fica para activar.

### Lista própria (migração 145)
`documentos_aeroporto` com os **mesmos identificadores** copiados do DIROPS, para os 215 documentos e as 31 pastas
continuarem a apontar para o mesmo sítio sem migração de dados. As chaves estrangeiras de `documento`, `pasta`,
`documentos_aeroporto_responsavel` e `documentos_acesso_aeroporto` deixaram de apontar para `public.aeroporto`.
Os responsáveis ganharam `cargo` e `telefone` e passaram a poder existir sem conta — 14 dos 19 não têm.
90 linhas de acesso a sítios que não são aeroportos da SGA (blocos petrolíferos, pistas privadas, Frankfurt) foram
retiradas, mas guardadas em `documentos_acesso_removido`. Ninguém ficou sem aeroportos.

### Lista oficial (migração 146)
O dono forneceu a lista oficial com ICAO, IATA, nome, cidade, província e director com email e telefone. A lista
herdada do DIROPS estava errada em três frentes, e a comparação vale como aviso para outros módulos:

| Problema | Quantos | Exemplo |
|---|---|---|
| A mais no portal (marca `isSGA` errada no DIROPS) | 7 | Ambriz, Cavango, Cazombo, Sanza Pombo, Nzeto, Nzagi, e um registo `FNZ5` cujo nome era «FNLU» |
| Em falta, todos com director nomeado | 4 | Cuíto Cuanavale, Ndalatando, Porto Amboim, Waku Kungo |
| Nome desactualizado | 15 | Benguela estava como «17 de Setembro»; Dundo como «Camaquenzo»; Luau como «General Rafael Sapilinha Sambalanga» |

Ficam **23 aeroportos, todos com responsável**. Decisões do dono: Luanda mantém `jpiedade` como responsável pelos
documentos, apesar de a directora na lista oficial ser outra; o Namibe fica com a grafia `pchiloia`, que é a que o
sistema já usa, com aviso no próprio registo porque a lista oficial diz `pchiloya` e não existe conta com nenhuma.

**A marca `isSGA` no DIROPS está errada nos dois sentidos** — marca sete que não são da SGA e não marca quatro que
são. O portal já não depende dela, mas as operações e os relatórios continuam a usá-la; vale corrigir lá.

### Ecrã
Gestão › Acessos › Aeroportos: criar, editar, desactivar quando tem conteúdo, apagar só quando não tem nada
agarrado; responsáveis com nome, cargo e telefone, vários por aeroporto, com «sem conta» marcado e convite ali
mesmo; membros por aeroporto. Testado com gravação real: administrador cria e edita, leitor comum recusado (403).
