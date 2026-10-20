# Edição no navegador (ONLYOFFICE Docs) — guia de instalação e activação

Para: TI da SGA e dono do DIROPS. Estado em 20/10/2026: **o código está pronto e desligado**; falta o servidor de
edição (Document Server), que precisa de mais recursos do que o SRVKMS001 tem hoje.

O que a funcionalidade faz: na ficha de um documento do GED, quem tem a **reserva** do documento carrega em
«Editar no navegador», o .docx «fonte» abre no editor (fiel ao Word: rodapés, tabelas, índice, controlo de
alterações), e ao fechar nasce uma **revisão nova em rascunho** (.docx + PDF gerado pelo LibreOffice). A versão em
vigor nunca é tocada; a revisão nova segue o fluxo de aprovação de sempre.

---

## 1. Requisitos (fontes oficiais)

| | Mínimo | Recomendado para nós | Fonte |
|---|---|---|---|
| CPU | 1 núcleo 2 GHz | 2 núcleos (produção) | [Requisitos Windows][req-win] |
| RAM | 2 GB (só para arrancar) | **4 GB+** dedicados (Docker: 4 GB + 4 GB swap) | [Requisitos Windows][req-win], [Requisitos Docker][req-docker] |
| Disco | **40 GB livres** | 60 GB (cache de documentos + logs) | idem |
| SO | Windows Server 2016+ 64 bits, ou Linux amd64 | Linux (Ubuntu 24.04 LTS) numa VM dedicada | idem |
| Dependências | até à 9.3: PostgreSQL 12.9+, RabbitMQ 3.9.12, Erlang 24.2 (o instalador Windows trá-los) | **9.4+: nenhuma** — processo único, sem RabbitMQ nem base de dados | [Instalar no Windows][inst-win], [Notas da 9.4][rel-94] |
| Licença | Community = AGPLv3, grátis | Desde a 9.4 (20/05/2026) **sem limite de 20 ligações simultâneas** (antes: 20 separadores a editar; a 21.ª abria só leitura) | [Notas da 9.4][rel-94], [Linuxiac][linuxiac] |

O instalador Windows traz também Visual C++ 2013 Redistributable, OpenSSL 3.3 e Win-ACME (este só para HTTPS, que
não usamos).

### O que medimos no SRVKMS001 (20/10/2026)

- **2 núcleos (Xeon Silver 4110 @ 2,1 GHz), 8 GB de RAM — 0,8 GB livres** no momento da medição (com um build
  em curso; em repouso fica tipicamente pouco acima), partilhados com PostgreSQL, PostgREST, 3× GoTrue, nginx, servidor de funções,
  LibreOffice (conversões) e o Check Point — que já hoje satura o CPU em picos (ver memória «lentidão CPU»).
- **≈ 19 GB livres em C:** — **abaixo dos 40 GB que o ONLYOFFICE exige**.
- Windows Server 2019: o Docker com contentores Linux precisa de WSL2/Hyper-V com LCOW, que o Server 2019 não
  suporta de forma estável (só WSL1). **Docker neste servidor: não.**

**Conclusão:** instalar no SRVKMS001 só depois de +4 GB de RAM **e** +40 GB de disco (outro volume serve).
**Recomendado:** uma VM Linux dedicada — 2 vCPU, **4–6 GB RAM, 60 GB disco** — e o SRVKMS001 fica só com o
procurador nginx (uma `location`). Uma VM separada também evita que o editor e o LibreOffice disputem os 2 núcleos.

---

## 2. Opção recomendada — VM Linux dedicada

1. VM Ubuntu 24.04 LTS, 2 vCPU, 4–6 GB RAM, 60 GB, IP fixo na rede interna (ex. `10.1.65.50`).
2. Instalar Docker (`apt install docker.io`) e arrancar o Document Server (versão **9.4 ou superior**):

   ```bash
   # o segredo é o MESMO texto que vai para C:\dirops\sga-onpremise\secrets\onlyoffice_jwt.txt (passo 4)
   sudo docker run -d --name onlyoffice --restart=always -p 80:80 \
     -e JWT_ENABLED=true -e JWT_SECRET='<segredo>' -e JWT_HEADER=Authorization \
     -e ALLOW_PRIVATE_IP_ADDRESS=true \
     -v /srv/onlyoffice/logs:/var/log/onlyoffice \
     -v /srv/onlyoffice/data:/var/www/onlyoffice/Data \
     -v /srv/onlyoffice/cache:/var/lib/onlyoffice \
     onlyoffice/documentserver:9.4
   ```

   `ALLOW_PRIVATE_IP_ADDRESS=true` é **obrigatório** na rede interna: por omissão o Document Server recusa
   descarregar ficheiros de IPs privados (protecção SSRF) e o editor ficaria a dizer «erro ao descarregar».
3. Teste: `curl http://10.1.65.50/healthcheck` → `true`.

## 2-bis. Alternativa — instalador Windows no SRVKMS001 (só depois do reforço de RAM e disco)

1. Descarregar o «ONLYOFFICE Docs Community for Windows» (9.4+) em onlyoffice.com/download-docs (o servidor tem
   internet via `Invoke-WebRequest`/`curl.exe`; ver memória «infra-internet-downloads»). Guardar em
   `C:\dirops\sga-onpremise\installers\`.
2. Instalar **noutra porta** (o nginx do DIROPS já usa a 80), num volume com ≥ 40 GB:
   `ONLYOFFICE-DocumentServer.exe /DS_PORT=8080 /DIR="D:\ONLYOFFICE\DocumentServer"`
   (até à 9.3 o assistente instala também PostgreSQL próprio, RabbitMQ e Erlang — **não** reutilizar o nosso
   PostgreSQL 16 do `dirops_sga`).
3. Editar `%ProgramFiles%\ONLYOFFICE\DocumentServer\config\local.json` (ou na pasta escolhida):
   - `services.CoAuthoring.token.enable.browser`, `…request.inbox`, `…request.outbox` = `true`
     (já vêm a `true` desde a 7.2, com segredo gerado ao acaso — **troque-o** pelo nosso);
   - `services.CoAuthoring.secret.browser.string`, `…inbox.string`, `…outbox.string` = `<segredo>`;
   - `services.CoAuthoring.request-filtering-agent.allowPrivateIPAddress` = `true`.
4. Reiniciar os serviços ONLYOFFICE (services.msc) e testar `curl.exe http://127.0.0.1:8080/healthcheck`.
5. **Check Point Harmony**: pôr a pasta do Document Server na lista de exclusões *antes* de o pôr em produção
   (já tirou o nssm de circulação uma vez — Gerisk 3194).

---

## 3. Portas e caminhos

```
navegador ──80──▶ SRVKMS001 nginx ──/onlyoffice/──▶ Document Server (127.0.0.1:8080 ou VM:80)
                       ▲                                      │
                       └──80── /functions/v1/documentos-onlyoffice/{ficheiro,retorno} ◀──┘
SRVKMS001 (Node :4001) ──▶ Document Server (descarregar o .docx editado: cache/files/…)
```

- Os utilizadores só falam com `http://srvkms001` (porta 80). O CSP do DIROPS é `'self'`: **o editor tem de vir
  pelo nginx**, nunca directo ao IP da VM.
- VM → SRVKMS001: TCP 80 aberto (o Document Server vai buscar o .docx e chama o callback).
- SRVKMS001 → VM: TCP 80 aberto (procurador + descarga do ficheiro editado).

---

## 4. Segredo JWT

Gerar um segredo forte **uma vez** e usá-lo nos dois lados (Document Server e DIROPS):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$seg = [Convert]::ToBase64String($b) -replace '[+/=]', ''
Set-Content -Path C:\dirops\sga-onpremise\secrets\onlyoffice_jwt.txt -Value $seg -NoNewline -Encoding ascii
icacls C:\dirops\sga-onpremise\secrets\onlyoffice_jwt.txt /inheritance:r /grant:r "Administrators:F" "SYSTEM:R"
```

(a conta que corre o `dirops-functions-v2` tem de o conseguir ler). **Nunca** pôr o segredo no git, na base de
dados ou num email. O módulo relê o ficheiro a cada minuto: trocar o segredo não exige reiniciar o Node (o Document
Server sim).

---

## 5. Ligar o DIROPS (por esta ordem)

1. **Migração 184** (colunas novas, tudo desligado):
   `psql -h 127.0.0.1 -U postgres -d dirops_sga -f C:\dirops\APP_DIROPS_v2\tools\ged-edicao\184_onlyoffice_config.sql`
   (pressupõe a 181 — reserva — já aplicada).
2. **Patch 31** no servidor de funções: `tools\ged-edicao\patch-31-onlyoffice-server.md` (duas inserções no
   `server.js`, `node --check`, `Restart-Service dirops-functions-v2`).
3. **nginx**: `tools\ged-edicao\nginx-onlyoffice.conf` (ajustar o `upstream onlyoffice_ds` para 127.0.0.1:8080 ou
   para a VM), `nginx -t`, reiniciar o serviço do nginx (o `-s reload` não funciona no serviço).
   Teste: `http://srvkms001/onlyoffice/healthcheck` → `true`; `http://srvkms001/onlyoffice/web-apps/apps/api/documents/api.js` → JavaScript.
4. **Frontend**: montar o botão (ver «Onde montar» abaixo), build e deploy habituais.
5. **Ligar**:

   ```sql
   UPDATE public.documentos_config SET
     onlyoffice_url         = 'http://srvkms001/onlyoffice',   -- visto pelo navegador (via nginx)
     onlyoffice_url_interna = 'http://127.0.0.1:8080',         -- visto pelo Node; VM: 'http://10.1.65.50'
     onlyoffice_retorno_url = 'http://10.1.65.45',             -- por onde o Document Server chega ao nginx do DIROPS
     onlyoffice_gerar_pdf   = true,
     onlyoffice_activo      = true
   WHERE id = 'geral';
   ```

   Diagnóstico: `curl.exe -s http://127.0.0.1:4001/functions/documentos-onlyoffice/estado` → `"activo":true`.
6. **Desligar** a qualquer momento: `UPDATE public.documentos_config SET onlyoffice_activo = false WHERE id='geral';`
   (de preferência sem ninguém a editar: com o interruptor desligado o callback é recusado e a revisão nova não nasce).

### Onde montar o botão

`src/documentos/components/edicao/BotaoEditarNavegador.jsx`, na ficha (`src/documentos/pages/PortalDocumento.jsx`),
junto ao `<ReservaDocumento …/>` (≈ linha 851):

```jsx
import BotaoEditarNavegador from '../components/edicao/BotaoEditarNavegador';
// …
<BotaoEditarNavegador documentoId={doc.id} versoes={versoes} titulo={doc.titulo}
  reservadoPorMim={estadoReserva(reserva) === 'activa' && reservadaPorMim(reserva, user?.email)} />
```

(`reserva` = `useReservaDocumento(doc.id).data`; `estadoReserva`/`reservadaPorMim` vêm de `hooksEdicao`.) Sem a
configuração ligada o componente não desenha nada, por isso pode ir já para produção.

---

## 6. Teste de aceitação — «fidelidade do MOA FNLU»

Documento: **MA-FNLU-MOA-001 — Manual de Operações do Aeródromo 4 de Fevereiro**, v9 «Fonte editável (.docx) —
Revisão 03/26» (2,8 MB, ≈157 páginas). Fazer com um utilizador de teste editor do documento.

1. Reservar o documento na ficha. Carregar em «Editar no navegador»: o editor abre em < 15 s.
2. Sem alterar nada, fechar → **não** deve nascer versão nova (auditoria `onlyoffice_fechado_sem_alteracoes`).
3. Reabrir. Fazer 3 alterações pequenas e anotadas: uma palavra no capítulo 1, uma célula na tabela das posições
   de estacionamento (A1–A6…), uma linha no Apêndice 12. Fechar.
4. Em ≤ 1 min aparece «Edição no navegador — Revisão 03/26» (v10, rascunho, .docx); em poucos minutos o PDF
   (v11, rascunho) e a v10 passa a «Fonte editável (.docx)». A v8 em vigor continua igual.
5. Descarregar a v10 e abrir no **Word** ao lado da v9. Conferir, página a página nas zonas críticas:
   - **rodapés** (revisão, data, «Página X de Y») — incluindo os do Apêndice 12 (págs. 149–150, que já se partiram uma vez);
   - **cabeçalhos** e quebras de secção (orientação paisagem/retrato onde existir);
   - **tabelas** (larguras, células unidas, sombreados, cabeçalho repetido);
   - **índice** (actualizar campo no Word: os números de página batem certo?);
   - numeração de capítulos/listas, imagens e legendas, controlo de alterações se usado;
   - número total de páginas (tolerância: ±1).
6. Comparar também o PDF gerado (v11) com o PDF em vigor (v8) — usar «Comparar versões» do GED.
7. Critério: **zero** diferenças em rodapés, tabelas e índice além das 3 alterações feitas. Se falhar, registar o
   quê e manter `onlyoffice_activo = false` (o caminho Word-descarregar-carregar continua a funcionar).
8. Limpar: apagar as versões de teste v10/v11 ou deixá-las como rascunho rejeitado; libertar a reserva.

---

## 7. Segurança (o que o módulo garante)

- O config do editor é assinado (HS256) e só sai para quem é gestor **ou** `pode_editar_documento`, **e** tem a
  reserva activa do documento. Versões obsoletas não abrem.
- O Document Server vai buscar o ficheiro com um token **próprio** de 15 min amarrado à versão (não usa endereços
  do storage).
- O callback só é aceite com o JWT do Document Server válido **e** o token do endereço (amarrado a documento,
  versão, chave e pessoa). O ficheiro editado só é descarregado do próprio Document Server (protecção SSRF).
- A gravação cria **sempre** versão nova em rascunho; conteúdo idêntico a uma versão recente não cria nada.
- Tudo vai para `log_auditoria` (módulo Documentos): `onlyoffice_abrir`, `_gravar`, `_pdf`, `_sem_alteracoes`, erros.

[req-win]: https://helpcenter.onlyoffice.com/docs/installation/docs-community-sys-reqs-windows.aspx
[req-docker]: https://helpcenter.onlyoffice.com/docs/installation/docs-community-sys-reqs-docker.aspx
[inst-win]: https://helpcenter.onlyoffice.com/docs/installation/docs-community-install-windows.aspx
[rel-94]: https://www.onlyoffice.com/blog/2026/05/onlyoffice-docs-9-4
[linuxiac]: https://linuxiac.com/onlyoffice-docs-9-4-removes-community-connection-limit/
