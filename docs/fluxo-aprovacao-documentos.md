# Fluxo de aprovação de documentos — contrato de implementação

Escrito a 2026-10-02. Acompanha a migração `C:\dirops\sga-onpremise\sql\156_fluxo_aprovacao.sql`, **que ainda não
foi aplicada**. Este documento é para quem vai implementar e não esteve na conversa: diz o que existe, o que falta
construir, e o que cada peça tem de fazer. O «porquê» de cada decisão de modelo está nos comentários da migração;
aqui está o «o quê».

Leitura prévia útil, mas não obrigatória: `pesquisa-mercado-ged.md` §3 (o que a lei angolana exige) e
`desenho-portal-documentos.md` (a direcção visual, que vale também para estes ecrãs).

---

## 1. O que isto é, em três frases

Um documento que vai entrar em vigor passa por três pessoas: **elaborador**, **revisor** e **director do
aeroporto**. Cada uma pratica um acto, e cada acto é assinado no portal com a senha da própria conta, deixando no
PDF um carimbo com nome, data/hora e **o significado do acto**. O email avisa e leva uma cópia; **assinar é
sempre no portal**.

Isto encaixa no que já existe e não substitui nada:

| Peça já em produção | Papel no fluxo |
|---|---|
| `documento_emenda` (migr. 150) | O fluxo pertence a uma emenda. Ao aprovar, preenche-lhe «Aprovado por», a data e a versão resultante. A emenda só pode seguir para a ANAC depois de o fluxo estar aprovado. |
| `documento_versao` (135) + vigor agendado (152) | O fluxo pertence a **uma** revisão. Ao aprovar, a revisão fica em `aprovado`. **Pôr em vigor continua a ser da 152** (`aplicar_vigor_agendado`): o fluxo não mexe em vigência. |
| `documento_estado_historico` (143) | O «percurso». Cada passo do fluxo escreve lá, além do rasto próprio. |
| `documentos_aeroporto_responsavel` (135) | De onde sai o director. O suplente nomeado entra pela mesma porta. |
| `pode_ver_documento()` / `pode_editar_documento()` (136b/136c) | Nenhuma regra de acesso nova foi inventada; tudo se ancora nestas. |

---

## 2. Estados e transições

Seis estados. Cada um responde a **«de quem está à espera?»**, que é a única pergunta do painel de gestão.

```
                   ┌──────────────┐
                   │  rascunho    │  do elaborador: a juntar ficheiros
                   └──────┬───────┘
         elaboração ✍     │                      ┌─────────────┐
                          ▼                      │  cancelado  │◀── de qualquer
                   ┌──────────────────┐          └─────────────┘    estado vivo
                   │ aguarda_revisao  │  do revisor
                   └──────┬───────┬───┘
            revisão ✍     │       │  devolver (motivo obrigatório)
                          ▼       ▼
          ┌───────────────────┐  ┌────────────┐
          │ aguarda_aprovacao │  │ devolvido  │ do elaborador (ou do revisor)
          └───────┬───────┬───┘  └─────┬──────┘
   aprovação ✍    │       │            │ nova submissão / nova revisão ✍
                  │       │ devolver   │   (ronda + 1)
                  ▼       └────────────┘
          ┌────────────┐
          │  aprovado  │  fim do percurso interno
          └────────────┘
```

A tabela de transições está declarada em SQL, em `documento_fluxo_transicao_valida(de, para)`. Qualquer salto que
lá não esteja é recusado pela base. Transições válidas, ao certo:

| De | Para | Quem | Produz assinatura? |
|---|---|---|---|
| `rascunho` | `aguarda_revisao` | elaborador | **sim** — acto `elaboracao` |
| `aguarda_revisao` | `aguarda_aprovacao` | revisor | **sim** — acto `revisao` |
| `aguarda_revisao` | `devolvido` (→ elaborador) | revisor | não |
| `aguarda_aprovacao` | `aprovado` | director ou suplente | **sim** — acto `aprovacao` |
| `aguarda_aprovacao` | `devolvido` (→ elaborador ou revisor) | director ou suplente | não |
| `devolvido` | `aguarda_revisao` | elaborador | **sim** — `elaboracao`, ronda nova |
| `devolvido` | `aguarda_aprovacao` | revisor (quando devolvido ao revisor) | **sim** — `revisao`, ronda nova |
| `rascunho` / `aguarda_revisao` / `aguarda_aprovacao` | `cancelado` | elaborador ou gestor, com motivo | não |

**Rondas.** Cada devolução incrementa `documento_aprovacao.ronda`. É por isso que pode haver mais do que uma
assinatura de elaboração no mesmo fluxo sem ambiguidade (`UNIQUE (fluxo_id, ronda, acto)`), e é por isso que uma
devolução pode trazer um PDF corrigido sem apagar o que já foi assinado: o par de ficheiros é **por ronda**.

**Cancelar não apaga assinaturas.** As que foram dadas ficam. Cancelar diz que o percurso não seguiu, não que o
acto não aconteceu.

---

## 3. Quem pode fazer o quê

A função `documento_fluxo_quem_pode(fluxo_id, acto, email)` é a autoridade. Devolve
`(pode, papel, em_substituicao_de, suplencia_id, motivo)`. **O ecrã usa-a para decidir se mostra o botão; a função
de assinar volta a chamá-la — o botão nunca é a autorização.**

- **Elaborador**: quem abriu o fluxo (`elaborador_email`, fixado na criação e nunca reescrito). Submete e
  re-submete.
- **Revisor**: exactamente o endereço em `revisor_email`. Pode ser trocado **só** enquanto o fluxo está em
  `rascunho` ou `devolvido` — trocar o revisor a meio é trocar o juiz depois de ver a sentença, e a base recusa.
- **Director**: o endereço em `director_email` **ou** quem hoje responde pelo aeroporto —
  `doc_directores_aeroporto(aeroporto_id)` devolve o titular (`documentos_aeroporto_responsavel`) e o suplente com
  nomeação viva. A segunda porta é o que impede o fluxo de morrer quando o director muda ou se ausenta.
- **Separação de funções**: quem elabora **não** revê nem aprova o mesmo documento, mesmo que seja o director. É
  a única garantia que a assinatura não consegue dar sozinha, por isso é regra na base.
- **Gestores e administradores do portal** vêem tudo o que já viam e podem cancelar um fluxo. **Não podem assinar
  no lugar de ninguém** — não há caminho para isso em lado nenhum do modelo.

### Suplentes

`documentos_aeroporto_suplente`: `(aeroporto_id, titular_email, email, nome, de, ate, motivo, nomeado_por)`.

- Nomeia-se **por administrador do portal** (`doc_admin()`), nunca por autonomeação.
- Janela de datas **obrigatória e fechada** (`ate` é NOT NULL): uma nomeação sem fim é um segundo director
  permanente, que é outra coisa e deve ser feita em `documentos_aeroporto_responsavel`.
- Uma suplência de um titular que já não é responsável **não conta** (a função verifica).
- Quando o suplente assina, a assinatura leva `em_substituicao_de` e o carimbo diz
  «Fulano (em substituição de Sicrano)». É esta frase que um inspector precisa de ler.

---

## 4. Os dois ficheiros por revisão

Até aqui cada documento tinha um ficheiro (`documento.arquivo_privado_uri`). Agora são **dois por revisão e por
ronda**, em `documento_ficheiro`:

| Papel | O que é | Onde vive | Quem chega lá |
|---|---|---|---|
| `pdf` | O que se aprova, se carimba, se distribui e se partilha | `uploads/` ou `private-uploads/`, conforme o documento | `pode_ver_documento()` — a regra de sempre |
| `editavel` | A semente da revisão seguinte (.docx, .xlsx, …) | **`private-uploads/editaveis/…`, sempre** | `pode_ver_editavel()` — mais apertada |

`UNIQUE (versao_id, papel, ronda)`: um PDF e um editável por ronda, presos à mesma revisão. Nunca o PDF de uma
revisão com o editável de outra.

### `pode_ver_editavel(documento_id)`

Verdadeiro para: administrador do portal; quem pode editar o documento; o autor e o responsável do documento;
o responsável (ou suplente) do aeroporto do documento; e quem é interveniente de algum fluxo desse documento.
**Um leitor comum nunca entra.** Sem sessão, nunca, em nenhuma circunstância.

Por cima disto, `documento.editavel_restrito_a text[]` fecha ainda mais: lista preenchida = apenas estes
endereços (o administrador continua a entrar). A lista **só aperta, nunca alarga**.

### Porque é que o editável não sai por um link partilhável

Quatro camadas, nenhuma dependente de alguém se lembrar de uma condição:

1. **Não existe ponteiro.** As rotas `/s/:token`, `/p/:token` e `/v/:token` resolvem o ficheiro **sempre** a
   partir de `documento.arquivo_privado_uri` / `documento.arquivo_url`, e de mais nada (ver `serveShareLink`,
   `serveFolderDoc`, `serveSelectionDoc` em `server.js`). Nenhuma delas lê `documento_ficheiro`.
2. **O prefixo é reservado e a base recusa-o.** Todo o editável vive sob `editaveis/`. Um gatilho recusa gravar um
   caminho com esse prefixo em `documento.arquivo_privado_uri`, `documento.arquivo_url` ou
   `documento_versao.arquivo_uri`. Copiar o caminho do editável para o campo do documento — por engano ou por
   script de migração — dá erro, não dá fuga.
3. **O link só sabe servir PDF.** `documento_link_partilha.papel_servido` com `CHECK (papel_servido = 'pdf')`
   (restrição `doc_link_so_pdf_chk`). Partilhar um editável obriga a largar uma restrição **com nome**, numa
   migração: acto deliberado e auditável, não descuido de configuração.
4. **Permissão própria + RLS.** A política de SELECT em `documento_ficheiro` escolhe `pode_ver_editavel()` para as
   linhas `editavel` e `pode_ver_documento()` para as `pdf`. `anon` não tem **um único privilégio** na tabela.

### Quando não há editável

Documentos antigos, digitalizações, coisas que vieram em papel. O fluxo **não pode parar por isso**. Na submissão,
se não houver linha `editavel`, a função exige `sem_editavel_motivo`; grava-o em
`documento_aprovacao.editavel_ausente` / `editavel_ausente_motivo` e segue. A ausência fica registada e
justificada, que é diferente de ficar em silêncio.

### Registo de acesso

Cada abertura, descarga **e recusa** de um ficheiro escreve em `documento_ficheiro_acesso`
(`ficheiro_id, documento_id, versao_id, papel, acao, email, nome, endereco_ip, equipamento, motivo, em`). Tabela
só de inserção, como o resto da auditoria desde a migração 149. A vista `documento_editavel_acessos` filtra só os
editáveis — é a lista que interessa a quem responde pela segurança do conteúdo.

---

## 5. A assinatura

### O que fica guardado (`documento_assinatura`)

- **Quem**: `signatario_email`, `signatario_nome`, `signatario_papel`, e `em_substituicao_de` quando é o suplente.
- **Quando**: `assinado_em`, **imposto por gatilho a `now()`** — o que o cliente mandar é descartado.
- **Significado**: `significado`, cópia da frase de `documento_acto` no momento da assinatura. Corrigir a redacção
  no futuro não muda o que esta pessoa assinou.
- **O quê**: `ficheiro_sha256`, `ficheiro_nome`, `ficheiro_bytes`, `ficheiro_id`.
- **Prova de contexto**: `endereco_ip`, `equipamento`, `segundo_fator`. **Prova, não porteiro** — não há lista de
  IPs permitidos: os directores estão em 23 aeroportos e em redes móveis.
- **A prova criptográfica**: `payload_canonico` (os bytes exactos que foram assinados, guardados em bruto),
  `algoritmo`, `chave_id`, `assinatura` (HMAC-SHA256), `codigo` (12 caracteres, para o carimbo),
  `cadeia_anterior` e `cadeia`.

### Verificar, anos depois

Três perguntas independentes, respondidas por `documento_assinatura_verificar(id)`:

| Campo devolvido | Pergunta |
|---|---|
| `assinatura_confere` | O HMAC do texto guardado bate com o guardado? |
| `ficheiro_intacto` | O ficheiro de hoje é o que foi assinado? (`sha256` actual vs. assinado) |
| `elo_confere` | O elo desta assinatura está bem formado? |

E `documento_assinatura_cadeia(documento_id)` percorre a cadeia pela ordem do tempo e devolve, por assinatura,
`elo_confere` e `ligacao_confere`. **`ligacao_confere = false` significa que falta uma assinatura ou que foi
intercalada uma** — é assim que se detecta uma data retroactivada ou um registo limpo à mão.

Porque é que verificar não parte com o tempo: guarda-se o **texto assinado em bruto**, não a receita para o
reconstruir. Verificar não depende da versão do PostgreSQL, da ordem das chaves JSON nem do formato da data. A
chave rodada fica em `documento_segredo` com `activa = false`, e a verificação procura a chave **pelo `chave_id`
da assinatura** — rodar a chave não invalida o passado.

### O carimbo no PDF

`documento_assinatura_carimbo(assinatura_id)` devolve as linhas exactas a desenhar. **O texto é produzido pela
base e não pelo desenhador do PDF**: se cada sítio escrever o seu, a frase do significado acaba por divergir entre
o PDF, o email e o ecrã — e é precisamente essa frase que a norma exige.

```
linha_1  Ana Paula Mendes (em substituição de João Pedro Silva)
linha_2  Director do aeroporto
linha_3  Aprovo este documento e autorizo a sua entrada em vigor e distribuição.
linha_4  02/10/2026 às 14:37 (UTC+01:00)
linha_5  Assinatura avançada · código 7KQZ-4JBX-9YTM
```

Hora de Angola (UTC+1, sem mudança de hora), com o fuso escrito. O endereço de verificação compõe-se no backend a
partir de `DOCS_PORTAL_BASE` + `verificacao_caminho` (a base não sabe em que domínio está o portal).

Os três carimbos acumulam-se: o PDF aprovado leva elaboração, revisão e aprovação, pela ordem em que aconteceram.
Desenhá-los é trabalho do backend (`pdf-lib` ou equivalente), numa página final de assinaturas ou no rodapé —
decisão de desenho, não de modelo. Depois de desenhar, marcar `carimbo_aplicado_em` / `carimbo_por` (as únicas
duas colunas que `service_role` pode actualizar nesta tabela).

### O segundo factor

A pessoa já está autenticada e **volta a escrever a senha da conta** para assinar. Dois cliques e a senha.

A verificação acontece **dentro da base** (`doc_senha_confere`, bcrypt do GoTrue via pgcrypto `crypt`), não no
backend. Se estivesse no backend, a função de assinar teria de aceitar «já verifiquei, confia» — e é esse o buraco
que o segundo factor existe para tapar. Consequência prática: assinar em nome de outra pessoa exige a senha dessa
pessoa.

Cuidados obrigatórios na implementação:

- A senha vai no **corpo** do pedido, nunca na query string, e **nunca** é registada em log.
- A chamada à RPC tem de ir **por parâmetro**, nunca interpolada no SQL (senão aparece em `pg_stat_activity`).
- `log_statement` **não pode** estar em `all` neste servidor.
- Cinco falhas em quinze minutos travam a conta (`doc_assinatura_travada`). Todas as tentativas, certas e
  erradas, ficam em `documento_assinatura_tentativa` — que é prova, além de travão.

---

## 6. Pontos de entrada que o backend precisa de ter

Convenção já usada no projecto: rotas `POST /functions/<nome>` em
`C:\dirops\sga-onpremise\functions\dirops-functions\server.js`, com `{ action: '…' }` no corpo
(ver `fnDocumentosAcesso`). Propõe-se **uma rota nova**, `POST /functions/documentos-aprovacao`.

Todas as acções exigem sessão válida (JWT). O backend **deriva o email do token** e passa-o às RPC — nunca aceita
um email vindo do corpo.

### `action: "abrir"`

Abre o fluxo. Única acção que pode ir directa à base pelo PostgREST se for mais cómodo
(`rpc/documento_fluxo_abrir`, concedida a `authenticated`): abrir não é acto de autoridade.

```jsonc
// recebe
{ "action": "abrir", "documento_id": "uuid", "versao_id": "uuid",
  "emenda_id": "uuid|null", "revisor_email": "…", "director_email": "…|null", "resumo": "…" }
// devolve
{ "ok": true, "fluxo_id": "uuid" }
```
`director_email` nulo → preenchido com o responsável do aeroporto do documento.

### `action: "ficheiros"` — carregar o par

Sobe o PDF e, se existir, o editável. **O editável vai sempre para `private-uploads/editaveis/<ano>/<documento_id>/`**;
qualquer outro caminho é recusado pela base. O SHA-256 calcula-se como já se faz no portal (JavaScript puro, o
servidor é HTTP e não há `crypto.subtle` — ver `src/lib/hashPassword.js` e a migração 152).

```jsonc
// recebe (multipart ou duas chamadas; a ronda NÃO vem do cliente)
{ "action": "ficheiros", "fluxo_id": "uuid",
  "pdf": { "caminho": "…", "nome": "…", "mime": "application/pdf", "tamanho": 123, "sha256": "…" },
  "editavel": { "caminho": "editaveis/2026/…/MOA-rev7.docx", "nome": "…", "mime": "…", "tamanho": 1, "sha256": "…" } }
// devolve
{ "ok": true, "pdf_id": "uuid", "editavel_id": "uuid|null", "ronda": 2 }
```

### `action: "assinar"` — os três actos

```jsonc
// recebe
{ "action": "assinar", "fluxo_id": "uuid",
  "acto": "elaboracao" | "revisao" | "aprovacao",
  "senha": "…",                       // nunca registada, nunca na query string
  "nota": "…|null",
  "sem_editavel_motivo": "…|null" }   // só na elaboração, quando não há editável
// devolve
{ "ok": true, "estado": "aguarda_aprovacao", "ronda": 1,
  "assinatura_id": "uuid", "codigo": "7KQZ-4JBX-9YTM",
  "acto": "revisao", "significado": "Revi este documento e confirmo…",
  "assinado_em": "2026-10-02T13:37:04.512Z", "signatario_nome": "…", "em_substituicao_de": "",
  "ficheiro": { "id": "uuid", "bucket": "private-uploads", "caminho": "…", "nome": "…", "sha256": "…" },
  "carimbo": { "linha_1": "…", "linha_2": "…", "linha_3": "…", "linha_4": "…", "linha_5": "…" } }
```

O backend: deriva o email do token → chama
`rpc/documento_fluxo_assinar(p_fluxo, p_acto, p_email, p_senha, p_ip, p_equipamento, p_nota, p_sem_editavel_motivo)`
**com a chave de serviço** (a RPC não está concedida a `authenticated`) → desenha o carimbo no PDF → marca
`carimbo_aplicado_em` → **no acto `aprovacao`, escreve `documento_versao.arquivo_uri`** com o caminho do PDF
assinado, segundo a convenção de caminhos do storage da aplicação (a migração não o faz de propósito: inventar
esse formato em SQL escreve caminhos errados em silêncio) → envia os emails da secção 8.

`p_ip` e `p_equipamento` saem de `univIp(req)` e do `user-agent`, como nas outras rotas.

Erros a tratar e a mostrar tal e qual:

| Situação | HTTP | Mensagem |
|---|---|---|
| senha errada | 401 | «Senha incorrecta.» |
| conta travada | 429 | «Demasiadas tentativas falhadas. Espere 15 minutos antes de voltar a assinar.» |
| não é o interveniente | 403 | o `motivo` de `documento_fluxo_quem_pode` |
| estado errado (já assinado noutro separador) | 409 | «O fluxo está em «…»: …» — e recarregar o ecrã |
| falta PDF | 400 | «Esta revisão não tem PDF carregado…» |
| falta editável e falta motivo | 400 | «Falta o ficheiro editável. Se não existe…, diga porquê e prossiga.» |

### `action: "devolver"`

```jsonc
{ "action": "devolver", "fluxo_id": "uuid", "motivo": "…", "para": "elaborador" | "revisor" }
→ { "ok": true, "estado": "devolvido", "para": "elaborador", "ronda": 2, "motivo": "…" }
```
Motivo **obrigatório** (a base recusa vazio). Não produz assinatura nem carimbo: devolver não é afirmar autoridade
sobre o conteúdo, é mandá-lo para trás. O que a devolução tem de deixar é o motivo, escrito, no percurso.
O revisor só devolve ao elaborador; o director devolve a qualquer um dos dois.

### `action: "cancelar"`

```jsonc
{ "action": "cancelar", "fluxo_id": "uuid", "motivo": "…" }
→ { "ok": true, "estado": "cancelado" }
```

### `action: "ficheiro"` — servir um ficheiro de `documento_ficheiro`

**Nova rota de descarga, separada das rotas públicas de partilha, e a única porta para o editável.**

```jsonc
{ "action": "ficheiro", "ficheiro_id": "uuid", "modo": "abrir" | "descarregar" }
→ 302 para um endereço assinado de curta duração, ou o ficheiro em streaming
```
Obrigatório: exigir sessão; confirmar `pode_ver_editavel()` para `papel = 'editavel'` (basta ler a linha com o
token do utilizador — a RLS decide por si); escrever sempre em `documento_ficheiro_acesso`, **incluindo as
recusas** (`acao: 'recusado'`, com motivo). Nunca aceitar `GET` com o id em query string partilhável.

### `action: "pendentes"` / `action: "fluxo"`

Leitura. Podem ir directas ao PostgREST sobre a vista `documento_aprovacao_pendente` e as tabelas
`documento_aprovacao_passo`, `documento_assinaturas_vista` — a RLS já decide quem vê o quê.

### Agendador

Uma linha em `scripts/relatorios/dispatcher.mjs`, ao lado da chamada de `aplicar_vigor_agendado`: lê
`documento_aprovacao_pendente` e envia **lembrete** ao fim de 3 dias parado e **escalonamento** ao gestor do portal
ao fim de 7, uma vez por ronda por tipo (`documento_aprovacao_aviso` diz o que já foi enviado). Nada de insistir
todos os dias: a habituação a avisos banais transfere-se para o aviso que importa.

---

## 7. Ecrãs

Seguem `desenho-portal-documentos.md`: lista densa, nada duplicado, zeros viram texto, estado no endereço.

### `/documentos/aprovacao` — a minha lista de trabalho
Quem sou eu neste fluxo decide a lista. Tabela densa: Documento (número + título, monoespaçado tabular), Revisão,
Emenda, **Espera por mim desde**, Aeroporto, Estado. Separadores: *Comigo* (predefinido) · *Submetidos por mim* ·
*Todos* (gestores). Vazio: «Não tem nada à espera de si.» — não um rectângulo em branco.

### `/documentos/aprovacao/:fluxo_id` — o ecrã onde se assina
Aqui aterra o botão do email. Três zonas:

1. **Cabeçalho** — número e título, revisão, emenda, o resumo do que muda, e uma linha que diz de quem se está à
   espera. Se o fluxo foi devolvido, **o motivo da devolução aparece aqui em cima**, não escondido no histórico.
2. **O documento** — o PDF em pré-visualização de página inteira (nunca modal). Ao lado, uma linha para o
   editável: nome, tamanho e botão de descarga **só para quem `pode_ver_editavel`**; para os outros, nada — nem
   botão desactivado nem explicação (não há nada a explicar a quem não tem de saber que existe). Se não há
   editável, mostra-se o motivo registado.
3. **O acto** — um só botão primário com o rótulo do acto (`documento_acto.rotulo`) e, ao lado, «Devolver».
   O botão primário abre um painel que mostra, **antes** de pedir a senha, exactamente o que vai ser assinado:
   > Vai assinar como **Director do aeroporto**.
   > *Aprovo este documento e autorizo a sua entrada em vigor e distribuição.*
   > Ficheiro: `MOA-FNLU-rev7.pdf` · impressão digital `a3f4…e9c1`
   > Fica registado o seu nome, a data e hora, o endereço de onde assina e o equipamento.

   Depois, o campo da senha e «Assinar». **Dois cliques e a senha** — nada mais no caminho.
   «Devolver» abre um painel com o motivo (obrigatório, mínimo útil ~10 caracteres) e, para o director, a escolha
   entre devolver ao elaborador ou ao revisor.

Depois de assinar: confirmação com o código da assinatura e o que acontece a seguir («segue para o director João
Pedro Silva, que foi avisado por email»).

### `/documentos/:id` — separador «Assinaturas»
Na ficha do documento, ao lado de versões e confirmações de leitura. Uma linha por assinatura: acto, nome (e
substituição), data/hora, código. Um sinal claro quando `ficheiro_intacto = false` ou a cadeia parte — e esse é o
**único** sítio, além do aviso de versão substituída, que merece destaque a sério.

### `/documentos/assinatura/:codigo` — verificar
Página de uma só pergunta: este código corresponde a quê? Mostra o que `documento_assinatura_verificar` devolve,
em português, com os três sinais separados (assinatura confere · ficheiro intacto · cadeia intacta). Exige sessão:
o GED é interno, e um verificador aberto diria a estranhos que documento existe e quem o assinou.

### `/documentos/gestao/aprovacoes` — painel do gestor
`documento_aprovacao_pendente` com «parado há» em destaque e ordenação por aí. Responde a «o que está travado e
em casa de quem», não a «quantos fluxos existem».

### `/documentos/gestao/aeroportos` — suplentes
No ecrã dos aeroportos que já existe (migr. 145/146), uma secção por aeroporto: responsável, suplente actual (se
houver) com a janela de datas, e «Nomear suplente» (só administrador). Um aeroporto cujo responsável não tem conta
no sistema aparece assinalado — são 14 dos 19, e sem eles a aprovação por responsável existe só no código.

---

## 8. Emails

Regra da casa (ver memória do projecto): o relay da SGA só entrega a `@sga.co.ao` e **bloqueia BCC/envio em massa
como spam (550)**. Enviar **um email por pessoa**, com `To:` individual. Nunca BCC.

Molde visual: `docsEmailHtml()`, que já existe. Todos levam o rodapé de `documentos_config`.

| Tipo | Para | Assunto | Corpo | Anexo | Botão |
|---|---|---|---|---|---|
| `pedido_revisao` | revisor | «Para revisão: ‹número› ‹título› (rev. N)» | quem submeteu, o que muda (resumo), aeroporto, há quanto tempo espera | **o PDF** | «Rever no portal» → `/documentos/aprovacao/:id` |
| `pedido_aprovacao` | director (ou suplente, dizendo-o) | «Para aprovação: ‹número› ‹título› (rev. N)» | quem elaborou, quem reviu e quando, o resumo | **o PDF** | «Aprovar no portal» |
| `devolvido` | elaborador (ou revisor) | «Devolvido: ‹número› ‹título›» | **o motivo, em destaque, por palavras de quem devolveu**, e quem devolveu | — | «Abrir no portal» |
| `aprovado` | elaborador, revisor, gestores do aeroporto | «Aprovado: ‹número› ‹título› (rev. N)» | quem aprovou, quando, o código da assinatura; e **que ainda não está em vigor** se houver data agendada | o **PDF carimbado** | «Ver no portal» |
| `lembrete` | quem está a dever | «Continua à sua espera: ‹número› ‹título›» | há quantos dias, e que basta entrar e assinar | — | «Abrir no portal» |
| `escalonamento` | gestores do portal | «Parado há N dias: ‹número› ‹título›» | de quem se espera, desde quando, quantos lembretes foram enviados | — | «Ver o painel» |

**O email leva a cópia, o portal recebe a assinatura.** Nenhum email leva token de assinatura, nenhum botão assina
nada. O botão aterra em `/documentos/aprovacao/:fluxo_id`; se não houver sessão, o portal pede entrada e volta lá.

O editável **nunca** vai em anexo, em nenhum destes emails.

Cada envio escreve em `documento_aprovacao_aviso` (`fluxo_id, ronda, tipo, para_email, assunto, anexou_pdf,
enviado, erro`). «Enviado» significa aceite pelo relay — não significa entregue; a nota sobre NDR vale aqui como
no resto do sistema.

---

## 9. O que fica registado, passo a passo

| Acontecimento | `documento_aprovacao_passo` | `documento_estado_historico` | `documento_assinatura` | Outros |
|---|---|---|---|---|
| Abrir | `aberto` | `fluxo:—` → `fluxo:rascunho` | — | — |
| Carregar ficheiros | — | — | — | `documento_ficheiro` (uma linha por papel e ronda) |
| Submeter | `submetido` | `fluxo:rascunho` → `fluxo:aguarda_revisao` | acto `elaboracao` | `documento_assinatura_tentativa` (sucesso) |
| Revisor assina | `revisto` | → `fluxo:aguarda_aprovacao` | acto `revisao` | idem |
| Devolver | `devolvido` **com motivo** | → `fluxo:devolvido`, nota com o motivo | — | ronda + 1 |
| Director assina | `aprovado` | → `fluxo:aprovado` | acto `aprovacao` | `documento_versao` → `aprovado`; `documento_emenda` → «Aprovado por», data, versão resultante |
| Carimbo desenhado | `carimbo_aplicado` | — | `carimbo_aplicado_em` | — |
| Email enviado | `aviso_enviado` | — | — | `documento_aprovacao_aviso` |
| Cancelar | `cancelado` **com motivo** | → `fluxo:cancelado` | — | assinaturas já dadas mantêm-se |
| Tentativa falhada | — | — | — | `documento_assinatura_tentativa` (motivo) |
| Abrir/descarregar ficheiro | — | — | — | `documento_ficheiro_acesso` (inclui recusas) |

Todas estas tabelas são **só de inserção** para `authenticated`, na linha da migração 149. O percurso da emenda
(`documento_estado_historico`) recebe uma nota legível por humanos em cada passo, do género:

> Fluxo de aprovação da emenda nº 7 (ronda 2): aprovado por ana.mendes@sga.co.ao

---

## 10. Ordem de implementação sugerida

1. Aplicar a migração 156 (depois de 152 e do que estiver entre elas). Guardar a chave gerada: está em
   `documento_segredo` e **tem de entrar na rotina de cópias de segurança** — sem ela, as assinaturas antigas
   deixam de ser verificáveis.
2. Rota `documentos-aprovacao` com `abrir`, `ficheiros`, `assinar`, `devolver`, `cancelar`, `ficheiro`. Reiniciar
   `dirops-functions-v2` (tarefa do dono).
3. Ecrã `/documentos/aprovacao/:id` e a lista. É o caminho crítico: sem ele não há onde assinar.
4. Carimbo no PDF. Até existir, a assinatura é válida na mesma — o carimbo é a cópia legível dela, não a prova.
5. Emails e, por fim, lembretes no dispatcher.
6. Ecrã dos suplentes. **Antes disto, convidar os 14 responsáveis de aeroporto que ainda não têm conta** — sem
   eles o fluxo não chega ao fim em metade dos aeroportos.

## 11. Armadilhas conhecidas

- **Dois separadores abertos.** Assinar no segundo dá 409 pela tabela de transições. Mostrar «este fluxo já
  avançou» e recarregar, nunca repetir a chamada.
- **A senha não é a senha de pasta.** Já existe uma «senha adicional» por documento/pasta
  (`requer_senha_adicional`, `docsSenhaToken`). São coisas diferentes e não se reaproveitam: aquela protege a
  descarga, esta prova a identidade de quem assina.
- **`auth` vs `auth_docs`.** `doc_senha_confere` escolhe o esquema por `documentos_config.auth_isolada` e tenta o
  outro a seguir. Se o portal passar a login isolado, as contas têm de existir lá (migração 139) ou ninguém
  assina.
- **Reinícios.** Patches ao `server.js` só valem depois de `Restart-Service dirops-functions-v2` — é tarefa do
  dono, e há um histórico de funcionalidades «que não funcionam» por este motivo.
- **Apagar um documento assinado.** `documento_assinatura.documento_id` é `ON DELETE RESTRICT`: um documento com
  assinaturas **não se apaga** da base. A lixeira (`deleted_at`) continua a funcionar como sempre. Se um
  administrador se queixar de que «excluir definitivamente» deixou de funcionar nalguns documentos, é isto, e é de
  propósito.
