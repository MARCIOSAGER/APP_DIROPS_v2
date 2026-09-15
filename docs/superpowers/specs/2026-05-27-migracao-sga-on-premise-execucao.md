# Spec: Migração DIROPS-SGA do Supabase Cloud para on-premise SRVKMS001

**Data:** 2026-05-27
**Autor:** Marcio Sager + Claude (sessão de execução)
**Status:** Em execução — fase de preparação

## 1. Objetivo

Migrar a instância DIROPS-SGA da SGA (Sociedade Gestora dos Aeroportos de Angola) do Supabase Cloud
para um servidor on-premise da SGA, preservando 100% do código frontend atual e mantendo o sistema
operacional para os 5 módulos solicitados (Operações, Safety, Inspeções, KPIs, GRF).

A SGA quer os dados na rede interna por requisito de soberania de dados; não há cobrança da SGA pela
infra (carta branca da TI), e sem custo recorrente de plataforma.

## 2. Decisões fechadas

| # | Decisão | Justificativa |
|---|---------|---------------|
| D1 | **Stack:** componentes Supabase nativos no Windows (sem Docker, sem Hyper-V) | SRVKMS001 só tem 2 vCPUs / 8GB; nested virt no VMware ESXi não confirmada; binários Go nativos cabem confortavelmente; zero reescrita do frontend |
| D2 | **Autenticação:** Supabase Auth (GoTrue) mantida na fase inicial | AD/LDAP avaliado depois; muda quando a SGA pedir SSO |
| D3 | **Importar TODOS os dados da SGA** (não filtrar por módulo) | Preservar foreign keys; módulos ocultos podem ainda referenciar dados |
| D4 | **Multi-tenancy:** importar APENAS `empresa_id = 128bc692-3fae-4825-9c55-40565dbedcfb` | SGA é o único tenant on-premise; demais empresas (ATO, etc.) ficam fora |
| D5 | **5 módulos visíveis:** Operacoes, Safety, Inspecoes, KPIsOperacionais, GRF | Pedido da SGA; demais páginas existem no código mas escondidas via flag |
| D6 | **Sem integrações externas:** FlightAware, FR24, OpenAI/Anthropic, Base44 legacy, Cloudflare metrics, Sentry — todos OFF | Servidor sem internet liberada para esses domínios; SGA não solicitou estes módulos |
| D7 | **Cobrança da SGA pela infra:** zero | Acordo comercial |

## 3. Arquitetura alvo

```
Usuário (browser na rede interna da SGA)
    │
    │ https://dirops.sga.local
    ▼
┌───────────────────────────────────────────────┐
│  SRVKMS001 (10.1.65.45) — Windows Server 2019 │
│                                                │
│  Nginx (Windows binary, porta 443/80)         │
│    │ reverse proxy                            │
│    ├── /              → frontend (vite build) │
│    ├── /rest/         → PostgREST :3000       │
│    ├── /auth/         → GoTrue :9999          │
│    ├── /storage/      → Storage API :5000     │
│    └── /realtime/     → (out of scope v1)     │
│                                                │
│  Serviços Windows:                            │
│    • PostgreSQL 16 (porta 5432, local-only)   │
│    • PostgREST.exe (binário Go)               │
│    • GoTrue.exe (binário Go)                  │
│    • Storage API (Node.js + PM2)              │
│                                                │
│  Dados em disco:                              │
│    C:\dirops\data\postgres\                   │
│    C:\dirops\data\storage\uploads\            │
│    C:\dirops\data\storage\private-uploads\    │
│    C:\dirops\data\backups\                    │
└───────────────────────────────────────────────┘
```

### Componentes — versões e fonte

| Componente | Versão alvo | Origem | Tipo |
|-----------|-------------|--------|------|
| PostgreSQL | 16.x | postgresql.org (Windows installer) | Serviço Windows |
| PostgREST | v12+ | github.com/PostgREST/postgrest/releases (Windows zip) | Serviço Windows (NSSM) |
| GoTrue / Supabase Auth | latest | github.com/supabase/auth/releases | Serviço Windows (NSSM) |
| Storage API | latest | github.com/supabase/storage-api | Node.js via PM2 |
| Nginx | mainline | nginx.org (Windows zip) | Serviço Windows (NSSM) |
| PM2 | latest | `npm i -g pm2 pm2-windows-startup` | Serviço Windows |
| NSSM | 2.24+ | nssm.cc | Para serviços não-nativos |

**Out of scope na v1:** Realtime (Elixir, mais pesado; voltar se a UI precisar), Edge Functions
(Deno; substituir os necessários por endpoints próprios em Node), Supabase Studio (interface admin —
não essencial), Kong (API Gateway — Nginx faz o papel).

## 4. Migração de dados

### 4.1 Source de verdade
Supabase Cloud atual da SGA. Service role key necessária para export (somente leitura,
sem alterações no Cloud).

### 4.2 Script
[scripts/sga-export/01-export-from-cloud.mjs](../../../scripts/sga-export/01-export-from-cloud.mjs)
classifica 60+ tabelas em 5 categorias:

- **Tenant (26 tabelas)** — filtrar `empresa_id = SGA OR NULL`
- **Child (14 tabelas)** — filtrar via FK ao pai SGA
- **Global (16 tabelas)** — export integral (lookups, configs, catálogos)
- **Special (2 tabelas)** — `empresa` (só row SGA), `solicitacao_acesso` (via `empresa_solicitante_id`)
- **Skip (6 tabelas)** — ephemeral/regenerável: cache, logs de auditoria, rate limit

Dry-run por padrão; `--execute` exigido para gravar JSONs em
[scripts/sga-export/data/](../../../scripts/sga-export/) + `_manifest.json`.

### 4.3 Storage e auth.users
Pendente — scripts separados a criar:
- `02-export-storage-blobs.mjs` — download recursivo dos buckets `uploads` e `private-uploads`
- `03-export-auth-users.mjs` — `auth.users` via Supabase Admin API (precisa service role)

### 4.4 Import no on-premise
Pendente. Estratégia:
1. Schema: aplicar `supabase/schema.sql` + todas as migrations `001..056` no Postgres on-prem
2. Dados: ler JSONs do export, fazer upsert via PostgREST autenticado com service_role JWT
3. Storage: copiar blobs para `C:\dirops\data\storage\<bucket>\` e popular `storage.objects`
4. Users: re-criar via GoTrue admin endpoint preservando UUID auth_id

## 5. Frontend — modo on-premise

### 5.1 Feature flag global
Nova var: `VITE_ON_PREMISE_MODE=true` (set no build do frontend para SGA).

### 5.2 Páginas visíveis
Allowlist em `src/Layout.jsx` (gate dentro de `hasAccessToPage`):

**Módulos principais (sidebar):**
- Operacoes
- Safety
- Inspecoes
- KPIsOperacionais
- GRF

**Páginas indispensáveis do fluxo de auth/perfil:**
- AlterarSenha, AguardandoAprovacao, ValidacaoAcesso
- ConfigurarPerfil, SolicitacaoPerfil

**Páginas legais e ajuda:**
- PoliticaPrivacidade, TermosServico
- GuiaUtilizador, Suporte *(decisão pendente — manter?)*

**Demais 32 páginas:** código permanece, mas `hasAccessToPage` retorna false → não aparecem no menu e rota direta cai no AccessDenied.

### 5.3 Integrações a desabilitar
| Integração | Ação |
|-----------|------|
| FlightAware | Feature flag `VITE_ENABLE_FLIGHTAWARE=false`; edge fn `flightaware-proxy` não deployada |
| FR24 | Já gated por `VITE_FR24_API_KEY` ausente; edge fn `fr24-proxy` não deployada |
| ChatbotIA / LLM | Remover `<ChatbotIA />` do Layout.jsx via flag; edge fn `chatbot-ia` não deployada |
| Base44 legacy | Sem imports ativos; edge fn `base44-sync` não deployada |
| Cloudflare metrics | Desabilitada; sem CDN on-premise |
| Sentry | Já gated por `VITE_SENTRY_DSN` ausente |
| ZAPI (WhatsApp) | **Decisão pendente** — SGA usa WhatsApp? |

### 5.4 Edge functions a manter
Estas precisam ser portadas para o ambiente on-premise (serviço Node.js separado, ou
inline no backend Storage API):
- `admin-user` — gestão de utilizadores
- `data-api` — API REST externa (Power BI). Alternativa: conexão Postgres direta como discutido.
- `get-dashboard-stats` — stats da Home
- `send-email` + `send-notification-email` — SMTP (depende da SGA fornecer servidor SMTP)

## 6. Servidor SRVKMS001 — estado e gaps

### 6.1 Diagnóstico em 2026-05-27

| Item | Estado |
|------|--------|
| OS | Windows Server 2019 Datacenter (1809) |
| CPU | 2 vCPUs (host Xeon Silver 4110) |
| RAM | 8 GB |
| Disco C: | 89.4 GB total — 63 livres |
| IP | 10.1.65.45 (Ethernet0, domínio SGA.NET) |
| Node.js | v20.18.0 ✓ |
| Git | 2.45.2 ✓ |
| PostgreSQL | ❌ não instalado |
| Nginx | ❌ não instalado |
| IIS | pasta `C:\inetpub` existe mas W3SVC **não instalado** (lixo de instalação anterior) |
| DNS de saída | OK para Docker/GitHub/Ubuntu/npm/Supabase (validado via `Resolve-DnsName`) |
| HTTP de saída | A validar — Marcio relatou que `update.code.visualstudio.com` é bloqueado |

### 6.2 Gaps a resolver
1. Validar HTTP outbound para domínios necessários (não DNS — esse passou)
2. Instalar PostgreSQL 16
3. Instalar Nginx Windows
4. Baixar binários PostgREST e GoTrue
5. Instalar PM2 + Storage API
6. Configurar 5 serviços Windows (Postgres, PostgREST, GoTrue, Storage, Nginx)
7. Gerar/instalar certificado SSL para dirops.sga.local
8. Configurar DNS interno SGA: `dirops.sga.local → 10.1.65.45`
9. SMTP da SGA (fornecido pela TI)

### 6.3 Pedidos à TI da SGA
- DNS interno: `dirops.sga.local → 10.1.65.45`
- Dados SMTP interno (host, porta, user, pass, sender)
- Whitelist HTTP para download de instaladores (se proxy bloqueia):
  - `*.postgresql.org`, `releases.ubuntu.com` (caso precise utils), `github.com`, `objects.githubusercontent.com`, `*.nginx.org`, `registry.npmjs.org`
- Certificado SSL: emitir da CA interna OU usar autoassinado (decisão deles)
- Backups: política de retenção e local de armazenamento

## 7. Fases de execução

| Fase | Conteúdo | Status |
|------|----------|--------|
| F0 | Diagnóstico inicial do SRVKMS001 | ✓ feito |
| F1 | Decisão de stack (componentes nativos) | ✓ feito |
| F2 | Spec consolidada | ✓ feito (este documento) |
| F3 | Script de export do Cloud (dados) | ✓ feito ([01-export-from-cloud.mjs](../../../scripts/sga-export/01-export-from-cloud.mjs)) |
| F4 | Scripts complementares: storage blobs + auth.users | pendente |
| F5 | Validação HTTP outbound + pedidos à TI da SGA | pendente |
| F6 | Instalação base: Postgres + Nginx + PostgREST + GoTrue + Storage | pendente |
| F7 | Aplicar schema + migrations no Postgres on-prem | pendente |
| F8 | Import dos dados exportados (dry-run primeiro) | pendente |
| F9 | Adicionar feature flag `VITE_ON_PREMISE_MODE` no frontend | pendente |
| F10 | Build do frontend on-premise + deploy via Nginx | pendente |
| F11 | Smoke tests com user real da SGA | pendente |
| F12 | Backup automatizado (`pg_dump` agendado + cópia da pasta storage) | pendente |
| F13 | Documentação operacional para a TI da SGA | pendente |
| F14 | Go-live + monitoramento | pendente |

## 8. Não-objetivos (out of scope explícito)

- Realtime (websockets Supabase Realtime). A UI atual usa polling/refetch em vez disso na maioria
  dos pontos. Se algum componente quebrar sem Realtime, reabrir.
- Supabase Studio (admin UI). Para administração direta de banco, usar pgAdmin ou psql.
- Edge Functions em Deno. Functions necessárias são portadas para Node.js dentro do Storage API
  ou como serviço separado.
- AD/LDAP / SSO. Fase pós-go-live.
- High availability / failover. SRVKMS001 é single instance; backup diário é o plano de recovery.
- CDN. Frontend servido direto pelo Nginx local; rede interna basta.
- Multi-empresa / multi-tenancy. Self-hosted é exclusivo da SGA.

## 9. Riscos conhecidos

| Risco | Mitigação |
|------|-----------|
| 2 vCPUs apertados em pico | Monitorar via Performance Monitor; pedir 4 vCPUs se necessário |
| HTTP outbound bloqueado por proxy SGA | Lista de whitelist preparada (seção 6.3); fallback: baixar instaladores em outro PC e copiar |
| GoTrue precisa de SMTP para reset de senha; SMTP SGA pode demorar | Permitir reset manual via DB pelo admin enquanto SMTP não vem |
| Storage API tem dependência Node 18+; precisamos validar funcionamento em Win Server 2019 | Plano B: implementar uploads diretos para disco via endpoint Node simples |
| Auth.users do Cloud não exportável trivialmente | GoTrue tem admin API; script `03-export-auth-users.mjs` resolve. Senhas serão resetadas no primeiro login |
| Backup esquecido = perda de dados | Tarefa agendada Windows com `pg_dump` + retenção 30 dias |

## 10. Aprendizados / contexto da sessão

Esta spec consolida decisões tomadas em conversa com Marcio em 2026-05-27, incluindo a
reversão da decisão original (Docker em VM Ubuntu/Hyper-V) para a estratégia atual (componentes
nativos no Windows), motivada pelo perfil real do SRVKMS001 (2 vCPUs, sem nested virt confirmada)
e pela ausência de qualquer custo recorrente diferenciador entre as opções de self-hosting.
