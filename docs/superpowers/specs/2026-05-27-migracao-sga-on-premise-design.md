# Migração DIROPS-SGA para Servidor On-Premise — Design Document

| | |
|---|---|
| **Documento** | Design Spec |
| **Versão** | 1.1 — escopo reduzido a 5 módulos core |
| **Data** | 2026-05-27 |
| **Autor** | Marcio Sager (com assistência Claude) |
| **Status** | Em revisão |
| **Próximo passo** | Plano de execução por fases |

---

## 1. Visão Geral e Objetivos

### 1.1 Contexto

O sistema DIROPS-SGA hoje roda na nuvem (frontend em Hostinger, backend em Supabase Cloud — PostgreSQL gerenciado, Auth, Storage e Edge Functions). A SGA solicitou que o sistema rode em infraestrutura própria da organização (servidor interno) por razões de soberania de dados, política de TI corporativa, e independência de provedores externos.

A SGA disponibilizou uma máquina virtual VMware no domínio Active Directory **SGA.NET**, com Windows Server 2019 Datacenter, 8 GB RAM e 89.4 GB de disco (servidor `SRVKMS001`, IP `10.1.65.45`). Este servidor já hospeda o serviço de **Volume Activation Services (KMS)** para ativação de licenças Windows da rede SGA.

### 1.2 Objetivos de negócio

1. **Soberania de dados** — todos os dados do DIROPS-SGA passam a residir na infraestrutura interna da SGA, sem trânsito por nuvem pública.
2. **Independência operacional** — sistema continua funcionando mesmo se a internet do aeroporto cair (acesso externo opcional via VPN).
3. **Handoff progressivo** — a TI da SGA ganha autonomia para operar e evoluir o sistema ao longo do primeiro ano, com suporte do autor.
4. **Conformidade com política interna** — sistema integrado ao Active Directory existente; sem credenciais paralelas; sem dependência de provedores externos para autenticação.

### 1.3 Escopo funcional — Módulos incluídos

A versão on-premise será uma **versão enxuta** do DIROPS-SGA, contendo apenas **5 módulos de negócio core**:

| # | Módulo | Função principal | Páginas envolvidas (referência) |
|---|---|---|---|
| 1 | **Operações** | Gestão de voos (chegadas, partidas, escalas, voos ligados) | `src/pages/Operacoes.jsx` + subcomponentes |
| 2 | **Safety** | Registo e gestão de ocorrências de safety (SGSO) | `src/pages/Safety.jsx` |
| 3 | **Inspeções** | Inspeções com checklists personalizáveis | `src/pages/Inspecoes.jsx` |
| 4 | **KPIs** | Indicadores operacionais (KPIsOperacionais) | `src/pages/KPIsOperacionais.jsx` |
| 5 | **GRF** | Movimentos financeiros (Gestão de Recursos Financeiros) | `src/pages/GRF.jsx` |

**Páginas de suporte essenciais (sempre necessárias):**
- Home / Dashboard
- Login (via AD)
- Perfil de usuário (logout, dados básicos)
- Gestão de Usuários (admin)
- Gerir Permissões (admin)
- Configurações Gerais
- Suporte / Guia do Utilizador

### 1.4 Não-objetivos (fora do escopo)

**Módulos completos NÃO migrados:**
- **Faturação / Proforma** — exceto cálculos básicos de tarifa dentro de Operações (a confirmar)
- **Reclamações** (passageiros)
- **Credenciamento** (acessos físicos)
- **Auditorias** (módulo formal)
- **Documentos** (gestão documental)
- **Ordens de Serviço**
- **Serviços Aeroportuários**
- **Configuração de Tarifas** (admin)
- **Gestão de Empresas** (admin superadmin)
- **Power BI** (integração externa — pode ser reativada conectando direto ao PostgreSQL)
- **Gestão de API Keys**
- **Gestão de Notificações** (regras configuráveis)
- **Log de Auditoria** (interno)
- **Lixeira**

**Integrações externas NÃO migradas:**
- **FlightAware** — páginas e dependências removidas
- **Chatbot com IA (OpenAI/Anthropic)** — página removida
- **FlightRadar24 (FR24)** — removida
- **Sincronização com Base44** — não aplicável (já desativado)
- **Métricas Cloudflare** — não aplicável fora do Hostinger
- **Power BI direto** — não migrado (TI SGA pode reativar conectando ao PostgreSQL local se desejarem)

**Outros:**
- **Migração de outros tenants** — fora do escopo. Esta migração trata apenas da SGA.

### 1.4 Stakeholders e responsabilidades

| Stakeholder | Papel | Responsabilidade |
|---|---|---|
| **Marcio Sager** | Arquiteto/Dev principal | Define arquitetura, escreve código (com Claude), coordena execução, revisa entregas |
| **Claude (AI assistant)** | Co-desenvolvedor contínuo | Escreve código, faz debug, atualiza documentação, sob supervisão humana |
| **TI da SGA** | Infra + operações | Provisiona servidor, libera firewall/AD, instala antivírus, opera RDP, fará handoff de manutenção |
| **Usuários SGA** | Consumidores finais | Validam funcionalidades (UAT), reportam bugs |

### 1.5 Glossário

| Termo | Significado |
|---|---|
| **DIROPS-SGA** | Sistema de Gestão de Operações Aeroportuárias da SGA |
| **SGA** | Sociedade Gestora de Aeroportos (Angola) |
| **SGA.NET** | Domínio Active Directory da SGA |
| **SRVKMS001** | Hostname do servidor de destino (VM VMware no domínio SGA.NET) |
| **KMS** | Key Management Service — serviço já existente no servidor para ativação Windows |
| **AD** | Active Directory |
| **LDAP** | Lightweight Directory Access Protocol — protocolo usado para autenticar contra AD |
| **NSSM** | Non-Sucking Service Manager — utilitário para rodar processos como Windows Services |
| **IIS** | Internet Information Services — servidor web nativo Windows |
| **RLS** | Row Level Security (PostgreSQL) |
| **UAT** | User Acceptance Testing |

---

## 2. Estado Atual (As-Is)

### 2.1 Arquitetura atual

```
[Usuário] → https://app.marciosager.com (Hostinger)
              ├─ React 18 + Vite 6 (build estático, ~3 MB)
              ↓
        [Supabase Cloud — glernwcsuwcyzwsnelad.supabase.co]
              ├─ PostgreSQL (banco gerenciado)
              ├─ GoTrue (Auth)
              ├─ Storage (uploads/, private-uploads/)
              └─ Edge Functions (Deno runtime)
```

### 2.2 Inventário de dependências Supabase no código

| Dependência | Uso | Volume |
|---|---|---|
| `@supabase/supabase-js` (cliente) | Todas as operações de dados | ~hundreds de chamadas em ~80 arquivos |
| `supabase.from('X').select()` | Leitura de entidades | Maior parte das chamadas |
| `supabase.auth.signIn/signUp/signOut` | Autenticação | Centralizado em `src/lib/AuthContext.jsx` |
| `supabase.storage.upload()` | Upload de arquivos | Centralizado em `src/components/lib/` |
| `supabase.functions.invoke()` | Chamada de Edge Functions | Centralizado em `src/functions/_invokeFunction.js` |

A boa notícia: o projeto **já tem uma camada de compatibilidade** em `src/api/base44Client.js` que abstrai as chamadas via Proxy. **A maior parte do frontend usa `base44Client.entities.X.list()` em vez de chamar Supabase diretamente.** Isso significa que a substituição pode ser concentrada em poucos arquivos:

- `src/api/base44Client.js` — camada de compat
- `src/entities/_createEntity.js` — factory que cria adaptadores
- `src/lib/AuthContext.jsx` — auth
- `src/functions/_invokeFunction.js` — invocação de funções
- `src/lib/supabaseClient.js` — cliente Supabase (será removido)

### 2.3 Edge Functions existentes (10 total)

Para o ambiente on-premise, apenas as funções **essenciais** serão migradas:

| Função | Decisão | Justificativa |
|---|---|---|
| `send-email` | **Migrar** | Email SMTP é core |
| `send-notification-email` | **Migrar** | Templates de notificação são core |
| `admin-user` | **Migrar** | Gestão de usuários é core |
| `get-dashboard-stats` | **Migrar** | RPC pode rodar direto no PostgreSQL via Node |
| `data-api` | **Migrar** | API read-only para Power BI (opcional, manter por flexibilidade) |
| `chatbot-ia` | ❌ Não migrar | Integração com OpenAI/Anthropic fora do escopo |
| `flightaware-proxy` | ❌ Não migrar | Integração FlightAware fora do escopo |
| `fr24-proxy` | ❌ Não migrar | Integração FR24 fora do escopo |
| `base44-sync` | ❌ Não migrar | Base44 já desativado |
| `cloudflare-metrics` | ❌ Não migrar | Específico do Hostinger |

**Total a migrar: 5 funções** (Deno → Node.js Express routes).

### 2.4 Volume estimado de dados (SGA)

A serem confirmados via script de inventário na Fase 3. Estimativa atual:

| Categoria | Estimativa |
|---|---|
| Banco de dados (registros SGA) | ~50-100 MB |
| Storage (uploads SGA) | ~500 MB - 2 GB |
| Logs e auditoria | ~50 MB |
| **Total** | **~1-3 GB** |

---

## 3. Servidor de Destino (Target)

### 3.1 Especificações confirmadas

| Item | Valor |
|---|---|
| Hostname | `SRVKMS001` |
| IP | `10.1.65.45` |
| Domain | `SGA.NET` (Active Directory) |
| OS | Microsoft Windows Server 2019 Datacenter |
| CPU | Intel Xeon Silver 4110 (8 cores @ 2.10 GHz) |
| RAM | 8 GB |
| Disco total | 89.4 GB |
| Plataforma | VMware (VMware7,1 hardware) |
| Time zone | UTC+01:00 West Central Africa |
| Acesso administrativo | RDP (Remote Desktop habilitado) |
| Windows Update | Gerenciado (auto) |
| Last patch | 2026-05-21 |
| Windows Defender | Não instalado (a corrigir antes do go-live) |
| Product ID | Não ativado (será ativado pelo próprio KMS) |

### 3.2 Restrições identificadas

1. **RAM limitada (8 GB)** — exige tuning conservador de PostgreSQL e Node.js
2. **Coabitação com KMS** — risco operacional cruzado: se o app travar a VM, KMS para; mitigado por limites de recursos
3. **Sem antivírus** — exige solicitar instalação de AV antes do go-live (Windows Defender, Kaspersky ou equivalente corporativo SGA)
4. **Firewall Windows OFF no perfil de domínio** — vamos depender da segurança de rede da SGA; configurar firewall granular no IIS/Node
5. **Internet só de saída** — usuários externos só acessam via VPN; integrações externas (SMTP) funcionam

### 3.3 Pré-requisitos a solicitar à TI SGA

- [ ] Instalar antivírus (Windows Defender ou equivalente)
- [ ] Criar conta de serviço no AD para o app (ex: `svc_dirops`) com permissão de leitura na unidade organizacional de usuários
- [ ] Criar registro DNS interno apontando `dirops.sga.net` → `10.1.65.45`
- [ ] Emitir certificado SSL interno (CA da SGA) para `dirops.sga.net`, OU autorizar uso de certificado autoassinado
- [ ] Fornecer credenciais SMTP (se houver servidor SMTP interno SGA; senão usaremos Hostinger SMTP via internet de saída)
- [ ] Liberar porta 443 entre clientes da rede e o servidor
- [ ] Confirmar política de backup (local de destino, retenção)
- [ ] Acesso RDP para conta administrativa (Marcio inicialmente, depois conta da SGA)

---

## 4. Arquitetura Proposta (To-Be)

### 4.1 Diagrama de componentes

```
┌────────────────────────────────────────────────────────────────────┐
│ VM: SRVKMS001 (Windows Server 2019 Datacenter — SGA.NET domain)    │
│ IP 10.1.65.45 • 8 GB RAM • 89.4 GB disk • Xeon Silver 4110         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Pré-existente — não tocar]                                       │
│   ├─ Volume Activation Services (KMS) — porta 1688                 │
│   └─ File and Storage Services                                     │
│                                                                    │
│  [Novo — DIROPS-SGA]                                               │
│   ├─ IIS 10 (porta 443, HTTPS)                                     │
│   │   ├─ Static site → D:\dirops\web\                              │
│   │   │     └─ React build (dist/) servido como estático           │
│   │   └─ Reverse Proxy (URL Rewrite + ARR)                         │
│   │         └─ /api/* → http://127.0.0.1:3001                      │
│   │                                                                │
│   ├─ Node.js 20 LTS + Express (porta 3001, bind 127.0.0.1)         │
│   │   ├─ Service via NSSM (auto-restart on crash)                  │
│   │   ├─ Mem limit: --max-old-space-size=512                       │
│   │   ├─ Auth: passport-ldapauth → AD SGA.NET                      │
│   │   ├─ Session: JWT (1h, refresh 24h)                            │
│   │   ├─ Uploads: Multer → D:\dirops\uploads\                      │
│   │   ├─ DB: pg (pool de 10 conexões)                              │
│   │   ├─ Email: nodemailer (SMTP)                                  │
│   │   └─ 5 rotas REST (substituem Edge Functions)                  │
│   │                                                                │
│   └─ PostgreSQL 16 nativo (porta 5432, bind 127.0.0.1)             │
│       ├─ Instalado via EDB Windows installer                       │
│       ├─ Data dir: D:\dirops\pgdata\                               │
│       ├─ shared_buffers = 1 GB                                     │
│       ├─ effective_cache_size = 3 GB                               │
│       ├─ work_mem = 16 MB                                          │
│       ├─ Schema: 56 migrations re-rodadas (idempotentes)           │
│       └─ Dados: filtrados por empresa_id da SGA                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

Fluxo de requisição:
  Browser SGA → VPN/LAN → IIS:443 → reverse proxy → Node:3001 → PG:5432
                                  ↓
                         Auth check (LDAP → SGA.NET AD)
```

### 4.2 Estimativa de consumo de RAM

| Componente | Consumo previsto |
|---|---|
| Windows Server + serviços base | ~1.5 GB |
| KMS (Volume Activation Services) | ~50-100 MB |
| PostgreSQL 16 (shared_buffers + work_mem + conexões) | ~1.5 GB |
| Node.js (Express + libs) | ~400-500 MB |
| IIS (worker process) | ~200-300 MB |
| Buffer livre + file cache OS | ~4 GB |
| **Total** | **~7.7 GB / 8 GB disponíveis** |

Margem apertada mas viável para carga moderada. Monitoramento contínuo via Performance Counters do Windows.

### 4.3 Layout de diretórios

```
D:\dirops\
  ├─ web\               # React build (gerado via npm run build)
  │   └─ dist\          # Arquivos estáticos servidos pelo IIS
  ├─ api\               # Código-fonte do backend Node
  │   ├─ src\
  │   ├─ node_modules\
  │   ├─ package.json
  │   └─ .env           # Variáveis de ambiente (DB, AD, SMTP)
  ├─ pgdata\            # PostgreSQL data directory
  ├─ uploads\           # Arquivos enviados pelos usuários
  │   ├─ public\
  │   └─ private\
  ├─ logs\              # Logs do Node + IIS + PG
  │   ├─ api\
  │   ├─ pg\
  │   └─ iis\
  └─ backups\           # Backups locais (pg_dump + uploads)
      ├─ daily\
      └─ weekly\
```

---

## 5. Estratégia de Substituição

### 5.1 Mapeamento Supabase → REST custom

| API Supabase | Endpoint custom equivalente |
|---|---|
| `supabase.from('voo').select('*')` | `GET /api/entities/voo` |
| `supabase.from('voo').select('*').eq('id', X)` | `GET /api/entities/voo/X` |
| `supabase.from('voo').insert({...})` | `POST /api/entities/voo` |
| `supabase.from('voo').update({...}).eq('id', X)` | `PATCH /api/entities/voo/X` |
| `supabase.from('voo').delete().eq('id', X)` | `DELETE /api/entities/voo/X` |
| `supabase.auth.signInWithPassword({email, password})` | `POST /api/auth/login` (valida no AD via LDAP) |
| `supabase.auth.signOut()` | `POST /api/auth/logout` |
| `supabase.auth.getSession()` | `GET /api/auth/session` (valida JWT) |
| `supabase.storage.upload(bucket, file)` | `POST /api/storage/:bucket` (multipart) |
| `supabase.storage.download(bucket, path)` | `GET /api/storage/:bucket/:path` |
| `supabase.functions.invoke('name', body)` | `POST /api/functions/:name` |

### 5.2 Reescrita do `base44Client.js`

O proxy atual:
```js
// Estado atual (Supabase)
entities: new Proxy({}, {
  get: (_, prop) => _createEntity(prop) // → chama supabase.from(...)
})
```

Será trocado por:
```js
// Estado novo (REST custom)
entities: new Proxy({}, {
  get: (_, prop) => _createEntity(prop) // → chama fetch('/api/entities/...')
})
```

A interface pública não muda. Chamadas como `base44Client.entities.Voo.list(filters)` continuam funcionando — só o "como" muda internamente.

### 5.3 Reescrita das Edge Functions Deno → Node.js

Padrão de conversão:

```ts
// Antes (Deno Edge Function)
import { serve } from "https://deno.land/std/http/server.ts";
serve(async (req) => {
  const body = await req.json();
  return new Response(JSON.stringify(result), { headers: { ... } });
});
```

```js
// Depois (Express route)
router.post('/functions/send-email', async (req, res) => {
  const body = req.body;
  // ... mesma lógica
  res.json(result);
});
```

Diferenças mínimas: imports CommonJS/ESM, `fetch` global (Node 18+), variáveis de ambiente via `process.env`.

### 5.4 Autenticação via Active Directory

**Substituição completa do Supabase Auth.** Usuários SGA logam com sua credencial AD existente — sem migração de senhas.

```
POST /api/auth/login
  body: { username: "joao.silva@sga.net", password: "..." }
  
  1. Backend usa passport-ldapauth para validar contra ldap://sga.net:389
  2. Se válido: busca/cria registro em public.users (sync via auth_id ou email)
  3. Gera JWT (sub=user.id, exp=1h) + refresh token (24h)
  4. Retorna JWT + dados do usuário
```

**Bibliotecas Node:**
- `passport-ldapauth` (validação LDAP/AD)
- `jsonwebtoken` (geração/verificação de JWT)
- `bcrypt` (apenas para usuários NÃO-AD se necessário; nativo SGA é AD)

**Tabela `users` no PostgreSQL** continua existindo (perfil, role, empresa_id), mas o campo `auth_id` agora referencia o ObjectGUID do AD (não mais o UUID do Supabase Auth).

### 5.5 Storage local em vez de Supabase Storage

- Bucket `uploads` (público) → pasta `D:\dirops\uploads\public\` servida pelo IIS como estática
- Bucket `private-uploads` → pasta `D:\dirops\uploads\private\` servida pelo Node com middleware de autenticação
- URLs antigas (`https://glernwcsuwcyzwsnelad.supabase.co/storage/v1/object/public/uploads/...`) serão **reescritas** durante a migração para `https://dirops.sga.net/uploads/public/...`

---

## 6. Estratégia de Migração de Dados

### 6.1 Categorização de tabelas (escopo reduzido)

Dado o escopo restrito aos **5 módulos core** (Operações, Safety, Inspeções, KPIs, GRF), apenas as tabelas relacionadas a esses módulos serão migradas. Tabelas de módulos fora de escopo (Reclamações, Credenciamento, Auditorias formais, Documentos, Faturação completa, etc.) não entram no banco on-premise.

**A — Tabelas multi-tenant a migrar (com `empresa_id`)** — apenas registros da SGA:

| Módulo | Tabelas |
|---|---|
| **Operações** | `voo`, `voo_bagagem`, `voo_registo_dep`, `recursos_voo`, `calculo_tarifa`, `registo_aeronave`, `aeroporto` |
| **Safety** | `safety` (ocorrências SGSO) |
| **Inspeções** | `inspecao`, `item_checklist`, `tipo_inspecao` |
| **KPIs** | `kpi`, `medicao_kpi` |
| **GRF** | `movimento_financeiro` ou equivalente do módulo GRF |
| **Suporte (sempre)** | `users`, `regra_permissao`, `configuracao_sistema` |
| **Cálculo de tarifa** (se Operações usa) | `tarifa_pouso`, `tarifa_permanencia`, `outra_tarifa`, `tarifa_recurso` |

Filtro padrão: `WHERE empresa_id = '128bc692-3fae-4825-9c55-40565dbedcfb'`

**Tabelas NÃO migradas** (módulos fora de escopo):
```
proforma, proforma_item, cobranca_participante, cliente,
auditoria, documento, ordem_servico, servicos_aeroportuarios,
reclamacao, credenciamento, solicitacao_acesso_aprovados,
solicitacao_servico, imposto, log_auditoria, registo_alterado,
external_api, api_key, api_access_log, api_rate_limit
```

**B — Tabelas compartilhadas (sem `empresa_id`)** — exportar tudo o que é referenciado pelos módulos in-scope:
```
modelo_aeronave, companhia_aerea, tipo_outra_tarifa
```

**C — Tabelas do schema `auth`** — não migrar (autenticação será via AD).

> **Nota:** o inventário definitivo de tabelas será produzido na Fase 0 (pré-execução), através de script de análise do schema atual + mapa de uso por módulo.

### 6.2 Roteiro técnico

| Etapa | Ferramenta | Tempo estimado |
|---|---|---|
| 1. Script de inventário (contagens por tabela) | SQL via Management API | 1h |
| 2. Recriar schema (56 migrations) no PG local | `psql -f migration.sql` em sequência | 2h |
| 3. Export filtrado por `empresa_id` (categoria A) | Node script com `pg` + COPY | 4h scripting + 1h execução |
| 4. Export completo das compartilhadas (categoria B) | Mesmo script | 30min |
| 5. Resolver chaves estrangeiras inter-tabela | Validação + retry order | 2h |
| 6. Download de Storage objects (uploads SGA only) | Node script via Storage REST API | 3h scripting + 2h execução |
| 7. Reupload para `D:\dirops\uploads\` | Cópia + ajuste de paths em DB | 1h |
| 8. Reescrever URLs no banco (Supabase → local) | UPDATE SQL com regex | 2h |
| 9. Validação final (FK integrity, contagens, queries críticas) | Script automatizado | 4h |
| **Total** | | **~22h** |

### 6.3 Identificação dos usuários SGA

Como autenticação passará para AD, **NÃO migramos senhas**. Mas precisamos:
1. Listar emails de usuários SGA existentes (do banco)
2. Verificar quais existem no AD (`@sga.net`)
3. Para os que NÃO existem no AD: pedir à TI SGA criação OU manter como conta "legacy" com senha temporária no banco
4. Para os que existem: vincular `users.auth_id` ao ObjectGUID do AD

---

## 7. Modelo de Manutenção (Claude-Assisted)

### 7.1 Fases do handoff

| Fase | Período | Quem desenvolve | Quem opera | Suporte de Claude |
|---|---|---|---|---|
| **Bootstrap** | Mês 0 (durante migração) | Marcio + Claude | N/A (ainda não em produção) | Intensivo |
| **Estabilização** | Mês 1-3 | Marcio + Claude | TI SGA com Marcio shadow | Diário |
| **Transição** | Mês 4-9 | TI SGA + Claude (Marcio revisa) | TI SGA | Semanal |
| **Autonomia** | Mês 10-12 | TI SGA + Claude | TI SGA | Sob demanda |
| **Pós-handoff** | Mês 13+ | TI SGA + Claude | TI SGA | Marcio como consultor pago |

### 7.2 Documentos vivos no repositório

Arquivos a criar/manter atualizados:

| Arquivo | Propósito |
|---|---|
| `CLAUDE.md` (raiz) | Instruções para qualquer sessão de Claude operando este repo: padrões, comandos comuns, convenções |
| `docs/RUNBOOK.md` | Procedimentos operacionais: reiniciar serviços, ver logs, troubleshoot comum |
| `docs/DEPLOY.md` | Passo-a-passo de deploy (git pull, npm ci, build, restart) |
| `docs/TROUBLESHOOTING.md` | Sintomas → causas → resoluções de problemas conhecidos |
| `docs/TRAINING.md` | Material de treinamento (índice; arquivos detalhados em `docs/training/`) |
| `docs/INSTALLATION.md` | Setup do zero do servidor (para cenário de disaster recovery) |
| `docs/ARCHITECTURE.md` | Versão "lite" deste design doc, mantida atualizada |

### 7.3 Workflow de mudanças (pós-handoff)

```
Usuário SGA reporta necessidade (bug ou feature)
        ↓
TI SGA abre sessão Claude no repositório
        ↓
Descreve o problema/desejo em linguagem natural
        ↓
Claude analisa código, propõe mudança (diff)
        ↓
TI SGA revisa o diff
        ↓
[Em caso de dúvida] Aciona Marcio para review
        ↓
Aplica → testa em staging (se houver) → deploy em produção
        ↓
Commit + tag de release no Git
```

### 7.4 Pré-requisitos para TI SGA usar Claude

- [ ] Assinatura Claude Pro ou Max (~$20-100/mês)
- [ ] Claude Code instalado nas máquinas dev
- [ ] Acesso ao repositório Git (clone read+write)
- [ ] Acesso RDP ao servidor para deploys
- [ ] Treinamento básico em uso de Claude (incluído no plano)

### 7.5 Plano de Treinamento da TI SGA

**Carga horária total: 24h** (3 dias úteis remotos ou presenciais).

**Módulo 1 — Conceitos e Arquitetura (4h)**
- Visão geral do DIROPS-SGA
- Arquitetura do servidor (PostgreSQL, Node, IIS)
- Fluxo de uma requisição completa
- Mapa de diretórios e arquivos críticos

**Módulo 2 — Operação Diária (4h)**
- Acessar o servidor (RDP)
- Verificar saúde dos serviços (PostgreSQL, Node, IIS)
- Ler logs (`D:\dirops\logs\`)
- Reiniciar serviços (NSSM, services.msc)
- Comandos PowerShell úteis

**Módulo 3 — PostgreSQL Essencial (4h)**
- Conectar via pgAdmin ou psql
- Queries básicas (SELECT, JOIN)
- Backup e restore (`pg_dump`, `pg_restore`)
- Monitorar tamanho de tabelas
- Identificar queries lentas

**Módulo 4 — Deploy e Atualizações (4h)**
- Fluxo de update: git pull → npm ci → build → restart
- Como interpretar release notes
- Rollback (Git revert + restore)
- Snapshot VMware antes de mudanças críticas

**Módulo 5 — Backup e Disaster Recovery (4h)**
- Estratégia de backup (diário, semanal, offsite)
- Como restaurar PostgreSQL completo
- Como restaurar uploads
- Reinstalar do zero (com `INSTALLATION.md`)

**Módulo 6 — Usando Claude como Co-Desenvolvedor (4h)**
- Onboarding em Claude Code
- Como descrever problemas para Claude
- Como revisar diffs propostos
- Quando aprovar vs quando pedir alternativa
- Quando escalar para Marcio

**Material entregue:**
- Apostila em PDF (versão impressa)
- Repositório Git com exemplos
- Gravações em vídeo de cada módulo
- Quiz de validação ao final de cada módulo

---

## 8. Operação e DevOps

### 8.1 Processo de deploy

```powershell
# No servidor, via RDP:
cd D:\dirops\api
git pull origin main
npm ci --omit=dev
cd D:\dirops\web
git pull origin main
npm ci
npm run build
xcopy /E /Y dist\* D:\dirops\web\dist\
nssm restart dirops-api
iisreset /noforce
```

Tudo isso será encapsulado num script PowerShell `Deploy-DIROPS.ps1`.

### 8.2 Estratégia de backup

| Backup | Frequência | Retenção | Destino |
|---|---|---|---|
| `pg_dump` (full) | Diário 02:00 | 30 dias | `D:\dirops\backups\daily\` |
| `pg_dump` (full) | Semanal Dom 03:00 | 12 semanas | `D:\dirops\backups\weekly\` |
| Uploads (rsync) | Diário 02:30 | 30 dias | `D:\dirops\backups\daily\uploads\` |
| Backup offsite | Semanal | 6 meses | A definir com TI SGA (NAS interno, fita, ou outro VM) |

Scripts automatizados via Task Scheduler do Windows.

### 8.3 Monitoramento

**Healthcheck endpoint:**
```
GET /api/health
{
  "status": "ok",
  "db": "ok",
  "uptime": 12345,
  "memory": { "rss": 245000000, "heap": 80000000 }
}
```

**Performance Counters Windows monitorados:**
- `\Memory\Available MBytes` (alerta < 1024)
- `\Processor(_Total)\% Processor Time` (alerta > 80% por 5min)
- `\PhysicalDisk(_Total)\% Disk Time` (alerta > 90% por 5min)
- Custom: process memory do Node `dirops-api`

**Logs centralizados em `D:\dirops\logs\`** com rotação:
- `api\app.log` (Winston, rotate diário, retenção 14 dias)
- `api\error.log` (errors only, rotate semanal, retenção 90 dias)
- `pg\postgresql.log` (config padrão PG, rotate 100MB)
- `iis\` (logs nativos IIS, rotate diário)

### 8.4 Rollback

| Cenário | Procedimento |
|---|---|
| Deploy quebrou app | `git reset --hard <commit>` + restart services |
| DB migration ruim | Restaurar `pg_dump` mais recente |
| Servidor inteiro corrompido | Restore do snapshot VMware (snapshot pré-deploy semanal) |
| Data loss | Restaurar `pg_dump` + uploads do backup diário |

---

## 9. Segurança

### 9.1 Autenticação

- Toda autenticação delegada ao **Active Directory SGA.NET** via LDAP sobre TLS (LDAPS porta 636 quando disponível, fallback porta 389)
- Backend nunca armazena senhas (zero password storage)
- Tokens JWT assinados com chave secreta forte (256-bit), rotacionada anualmente
- Tokens com expiração curta (1h access, 24h refresh)

### 9.2 Autorização (RBAC)

Sistema existente mantido: tabela `regra_permissao` controla acesso por role + página. Roles SGA atuais preservados:
- `superadmin` — gestão total
- `administrador` — 27 páginas
- `operacoes` — 17 páginas
- `gestor`, `operador`, demais conforme já configurado

### 9.3 Comunicação

- **Browser → IIS**: HTTPS obrigatório (cert interno SGA ou autoassinado em fallback)
- **IIS → Node**: HTTP localhost (mesmo processo de máquina, sem TLS necessário)
- **Node → PG**: localhost socket/TCP, sem TLS (mesma máquina)
- **Node → AD**: LDAPS se disponível, senão LDAP STARTTLS

### 9.4 Hardening Windows

- Windows Defender (a ser instalado pré-go-live)
- Firewall Windows reativado nos perfis Public/Private (Domain pode permanecer Off conforme política SGA)
- Regras de firewall específicas para IIS (443), bloqueio de 3001 e 5432 a tudo exceto localhost
- Patches automáticos via Windows Update gerenciado (já configurado)
- Contas de serviço com privilégio mínimo (svc_dirops sem direitos de admin local)

### 9.5 Auditoria

- Tabela `log_auditoria` (já existente) preservada para audit trail interno
- Logs do Node incluem `username` em cada request (extraído do JWT)
- IIS logs preservam IPs de origem
- Tentativas de login falhadas registradas (para detectar brute force)

---

## 10. Testes e Validação

### 10.1 Testes automatizados (mantidos)

O projeto tem **282 testes Vitest** atualmente. Estratégia:
- Testes que não dependem de Supabase (componentes puros, validações Zod, formatadores): **mantidos sem mudança**
- Testes que dependem de Supabase: **adaptados** para usar o novo cliente REST
- Adicionar suite de testes de integração para o backend Node (Vitest + supertest)

Meta pós-migração: **>90% dos testes passando** + nova suite backend com **cobertura mínima de 70%** das rotas críticas.

### 10.2 Testes de integração

Ambiente de **staging** sugerido (não obrigatório):
- Outra VM ou subdiretório no mesmo servidor (porta 3002, banco separado `dirops_staging`)
- Permite testar deploys antes de produção

### 10.3 UAT (User Acceptance Testing)

| Etapa | Duração | Participantes |
|---|---|---|
| Smoke test interno (Marcio) | 1 dia | Marcio |
| UAT operações | 3 dias | 3-5 usuários operacionais SGA |
| UAT administração | 2 dias | TI SGA + administrador DIROPS |
| Correção de bugs encontrados | 3 dias | Marcio + Claude |
| Re-UAT | 1 dia | Mesmos usuários |
| Go-live | 1 dia | Todos |

**Checklist de UAT** será derivado dos requisitos do `PROPOSTA_COMERCIAL_DIROPS_SGA.md` (12 módulos funcionais).

### 10.4 Plano de smoke test pós-deploy

Script automatizado executando:
1. `GET /api/health` retorna 200
2. Login com conta de teste AD funciona
3. Criar 1 voo de teste
4. Listar voos
5. Gerar 1 proforma de teste
6. Download de PDF gerado
7. Upload de 1 arquivo de teste
8. Enviar 1 email de notificação de teste
9. Verificar dashboard stats carregam
10. Logout

---

## 11. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Coabitação com KMS afeta operação | Média | Alto | Limites de RAM Node (--max-old-space-size); monitoramento contínuo; snapshot diário VMware |
| 2 | 8 GB RAM insuficientes em pico | Média | Médio | Tuning conservador desde início; métricas; pedir upgrade se KPI crítico for atingido |
| 3 | Renegociação contratual difícil (proposta dizia Ubuntu+Supabase) | Média | Médio | Documento técnico de adendo justificando Windows nativo; preservar funcionalidades equivalentes |
| 4 | Falha na migração de dados (integridade) | Baixa | Alto | Script com validação de FK em cada etapa; rollback fácil (banco novo, não toca o Cloud) |
| 5 | Usuários SGA sem conta no AD | Média | Médio | Inventário prévio; pedir criação à TI SGA; fallback de conta legacy com senha temporária |
| 6 | Bugs em features que dependiam de Supabase Realtime | Média | Médio | Realtime não é crítico para DIROPS; substituir por polling onde necessário |
| 7 | Performance degradada vs Cloud | Média | Baixo | PostgreSQL local geralmente mais rápido (menor latência); benchmark em UAT |
| 8 | TI SGA não absorve handoff no prazo | Média | Médio | Plano de treinamento estruturado; Marcio disponível pós-handoff como consultor |
| 9 | Servidor sem antivírus = vulnerabilidade | Alta | Alto | Bloquear go-live até AV instalado; verificar política SGA |
| 10 | Internet caí e bloqueia SMTP externo | Baixa | Baixo | Configurar SMTP interno SGA como fallback (se existir) |
| 11 | KMS reativado ou modificado pela TI SGA afetando nossa app | Baixa | Médio | Documentar configuração inicial; coordenação contínua com TI SGA |
| 12 | Disco de 90 GB encher em 1-2 anos | Média | Médio | Política de retenção de logs/backups; pedir upgrade de disco em VMware (trivial) |

---

## 12. Cronograma e Marcos

### 12.1 Fases macro

| Fase | Nome | Duração | Marcos |
|---|---|---|---|
| **0** | Pré-execução | 1 semana | Aprovação spec, plano detalhado, inventário de tabelas, acessos liberados |
| **1** | Preparação do servidor | 1 semana | PostgreSQL, Node.js, IIS instalados; AD validado; DNS configurado |
| **2** | Backend custom (Node + Express) | 1.5-2 semanas | API REST funcionando; LDAP auth; 5 funções migradas |
| **3** | Frontend adaptado | 1 semana | base44Client.js reescrito; páginas fora de escopo ocultadas; build OK |
| **4** | Migração de dados | 3-4 dias | Schema + dados SGA importados (só módulos in-scope); storage migrado |
| **5** | UAT | 1 semana | 5 módulos validados; bugs críticos corrigidos |
| **6** | Go-live + estabilização | 2 semanas | Sistema em produção; suporte intensivo |
| **TOTAL** | | **7-8 semanas** | |

### 12.2 Dependências externas (bloqueios potenciais)

- Acesso RDP + credencial administrativa → **TI SGA** (sem isso, Fase 1 não começa)
- Criação de conta de serviço AD → **TI SGA** (sem isso, auth não funciona)
- Certificado SSL → **TI SGA** (não-bloqueante, fallback autoassinado)
- Antivírus → **TI SGA** (bloqueia go-live, não as fases anteriores)

### 12.3 Critérios go/no-go por fase

| Fase | Vai para próxima se... |
|---|---|
| 1 | Healthcheck do PostgreSQL e Node respondendo |
| 2 | Pelo menos 90% dos endpoints REST passando testes |
| 3 | Frontend faz login com conta AD real e lista 1 voo |
| 4 | Validação de dados aprovada (contagens batem, FK OK) |
| 5 | Zero bugs críticos abertos; usuários aprovam |
| 6 | 14 dias sem incidente crítico → handoff começa |

---

## 13. Custo Detalhado por Fase

### 13.1 Estrutura de custos

Baseado em **$100/hora** para desenvolvimento (alinhado com a proposta original, faixa intermediária).

**Câmbio aproximado**: 1 USD = 880 Kz (Março 2026 — pode variar).

### 13.2 Custos por fase (escopo reduzido — 5 módulos core)

| Fase | Horas estimadas | Valor (USD) | Valor (Kz) |
|---|---|---|---|
| **0 - Pré-execução** (planejamento, inventário, alinhamento) | 16h | $1.600 | 1.408.000 Kz |
| **1 - Preparação do servidor** (PG, Node, IIS, AD, AV) | 24h | $2.400 | 2.112.000 Kz |
| **2 - Backend custom** (LDAP, REST, 5 funções essenciais) | 60h | $6.000 | 5.280.000 Kz |
| **3 - Frontend adaptado** (base44Client + ocultação de páginas fora de escopo) | 24h | $2.400 | 2.112.000 Kz |
| **4 - Migração de dados** (escopo reduzido — só tabelas dos 5 módulos) | 16h | $1.600 | 1.408.000 Kz |
| **5 - UAT** (5 módulos para validar) | 24h | $2.400 | 2.112.000 Kz |
| **6 - Go-live + estabilização** (2 semanas suporte intensivo) | 32h | $3.200 | 2.816.000 Kz |
| **Treinamento TI SGA** (24h estruturadas) | 24h | $2.400 | 2.112.000 Kz |
| **Documentação técnica** (RUNBOOK, DEPLOY, INSTALLATION, TRAINING) | 16h | $1.600 | 1.408.000 Kz |
| **Contingência** (10% sobre subtotal) | 24h | $2.360 | 2.076.800 Kz |
| **TOTAL** | **~260h** | **$25.960** | **22.844.800 Kz** |

### 13.3 Suporte pós-implantação (recorrente)

Conforme proposta original (3 meses de suporte inclusos):

| Período | Modalidade | Custo |
|---|---|---|
| Meses 1-3 (incluído no preço acima) | Suporte intensivo + correção bugs | Incluso |
| Meses 4-12 | Sob demanda — $150/h | Variável |
| Mês 12+ (pós-handoff) | Consultoria pontual — $150/h | Variável |

### 13.4 Custos por conta da SGA

| Item | Custo |
|---|---|
| Servidor (VM já existente) | 0 |
| Antivírus (caso não tenham licença corporativa) | A definir |
| Certificado SSL interno (se CA própria) | 0 |
| Licenças Power BI (caso integrem) | Por usuário |
| SMTP (Hostinger atual ou interno SGA) | Já existente |
| Energia, rede, backup | Já no orçamento de TI |

### 13.5 Comparativo vs proposta original ($22.500)

A proposta original previa Ubuntu + Supabase Self-Hosted ($22.500) com **todos os 12 módulos funcionais**. O presente plano (Windows nativo + reescrita backend + **escopo reduzido a 5 módulos**) custa $25.960 — apenas **15% acima** da proposta original, apesar da reescrita significativa do backend, porque:

1. **+** Reescrita do backend (de Supabase para REST custom): trabalho extra
2. **+** Adaptação para Windows (sem Docker/Supabase): tuning específico
3. **+** Treinamento expandido para TI SGA
4. **−** Escopo funcional reduzido (5 de 12 módulos): economia que compensa parte do extra
5. **−** Sem chatbot IA, sem FlightAware, sem FR24: features complexas que saíram do escopo
6. **−** Auth via AD em vez de implementação custom: economia significativa

**Adendo a apresentar à SGA**: documento separado justificando a mudança de stack e escopo, alinhando valor com proposta original.

---

## 14. Renegociação Contratual

### 14.1 Diferenças vs PROPOSTA_COMERCIAL_DIROPS_SGA.md

| Item | Proposta original (Cenário B) | Plano atual |
|---|---|---|
| OS do servidor | Ubuntu 22.04 LTS | Windows Server 2019 Datacenter |
| Stack de aplicação | Supabase Self-Hosted via Docker | Node.js + PostgreSQL nativo + IIS |
| Auth | Supabase Auth (GoTrue) | Active Directory via LDAP |
| Funcionalidades de IA (chatbot) | Inclusas | Removidas |
| Funcionalidades FlightAware/FR24 | Inclusas | Removidas |
| Tempo de instalação | 4-6 horas | ~9-10 semanas (rescrita necessária) |
| Custo total | $22.500 | $36.520 |

### 14.2 Justificativa técnica para renegociação

1. **OS Windows**: SGA não disponibilizou Ubuntu. Adaptar para Windows requer reescrita significativa (sem Supabase Stack no Windows nativo).
2. **AD integration**: requisito implícito do ambiente corporativo SGA, não previsto na proposta original — agrega valor (UX, segurança, governança).
3. **Remoção FlightAware/IA**: simplifica escopo; cliente pode reativar essas integrações no futuro contratando módulos adicionais.
4. **Treinamento expandido**: handoff total requer mais investimento em capacitação.

### 14.3 Documento de adendo a apresentar à SGA

Será um documento separado (não esta spec) contendo:
- Resumo executivo da mudança
- Justificativa técnica
- Novo escopo e preço
- Cronograma revisado
- Opções alternativas (voltar a Ubuntu+Supabase com preço original)

A produzir após aprovação interna desta spec.

---

## 15. Decisões Consolidadas

| # | Decisão | Alternativas consideradas | Escolha | Rationale |
|---|---|---|---|---|
| 1 | Escopo da migração | Frontend only / Backend only / Full stack | **Full stack** | Soberania de dados completa |
| 2 | Acesso à internet | Bidirecional / Saída / Isolado | **Saída apenas** | Decisão da TI SGA |
| 3 | Tenants migrados | Todos / Apenas SGA | **Apenas SGA** | Outros tenants ficam fora do escopo |
| 4 | Acesso usuários | LAN / VPN / Reverse proxy | **LAN + VPN** | Política SGA, sem exposição externa |
| 5 | Banco de dados | Supabase Self-Hosted / PostgreSQL nativo / SQL Server | **PostgreSQL 16 nativo Windows** | Reaproveita 56 migrations existentes; sem licença |
| 6 | Backend runtime | Node.js / .NET 8 / Python | **Node.js 20 LTS** | Reaproveita Edge Functions Deno; expertise existente |
| 7 | Web server | IIS / Nginx for Windows / Caddy | **IIS** | Nativo Windows; TI SGA conhece |
| 8 | Autenticação | JWT custom / OAuth / **AD LDAP** | **AD LDAP** | Servidor já no domínio; UX superior; zero migração de senhas |
| 9 | Manutenção pós-migração | Marcio só / SGA TI só / **Híbrido com Claude** | **Híbrido com Claude** | Pragmatismo; handoff gradual |
| 10 | KMS coabitando | Mover KMS / **Aceitar coabitação** | **Aceitar com isolamento** | Pragmatismo; risco mitigável |
| 11 | RAM | 8GB / 16GB / 32GB | **8GB (sem upgrade)** | Decisão do usuário; tuning conservador |
| 12 | Storage | Filesystem local / Object storage / S3-compat | **Filesystem local** | Simplicidade; sem dependências adicionais |
| 13 | Edge Functions migrar | Todas 10 / Algumas | **5 de 10** | FlightAware/IA/Base44/CF fora do escopo |
| 14 | Multi-tenancy no código | Manter / Remover | **Manter código, filtrar dados** | Menos risco; estrutura preservada |
| 15 | Senhas dos usuários | Migrar hashes / Forçar reset / **AD** | **AD substitui** | Não há senhas para migrar |
| 16 | Escopo funcional | App completo (12 módulos) / **Subset (5 módulos)** | **5 módulos: Operações, Safety, Inspeções, KPIs, GRF** | Decisão do cliente; reduz custo e risco; foco em essenciais |
| 17 | Proforma/Faturação | Incluir / **Não incluir** | **Não incluir** (a confirmar) | Não listado pelo cliente; reavaliar se quebrar fluxo de Operações |

---

## 16. Próximos Passos Imediatos

### 16.1 Aprovação desta spec
- [ ] Marcio revisa e aprova
- [ ] (Opcional) Apresentar resumo à TI SGA para alinhamento

### 16.1.1 Decisões pendentes (bloqueios para Fase 0)

| # | Decisão pendente | Quem decide | Impacto se não decidido |
|---|---|---|---|
| 1 | **Proforma incluída ou não em Operações** | SGA + Marcio | Operações calcula tarifa mas pode não emitir proforma — fonte de GRF fica indefinida |
| 2 | **GRF: fonte dos movimentos financeiros** | SGA | Se não Proforma → manual? Import externo? Define se precisamos integração |
| 3 | **Auditorias e Documentos** (lista de não-objetivos) | SGA | Confirmar com SGA que estes módulos não são necessários |
| 4 | **SMTP**: usar Hostinger externo ou interno SGA | TI SGA | Bloqueia configuração de envio de email |
| 5 | **Certificado SSL**: CA interna SGA ou autoassinado | TI SGA | Não bloqueia mas afeta UX (avisos no navegador) |

### 16.2 Pré-execução (Fase 0)
- [ ] Gerar plano de execução por fases via `writing-plans` (próximo passo do fluxo)
- [ ] Listar pré-requisitos concretos a solicitar à TI SGA
- [ ] Definir cronograma com datas reais
- [ ] Preparar documento de adendo contratual

### 16.3 Acessos a confirmar com TI SGA
- [ ] RDP via VPN para `10.1.65.45`
- [ ] Conta administrativa local no servidor
- [ ] Conta de serviço AD `svc_dirops` (read na OU de usuários)
- [ ] Credenciais para configurar DNS interno (`dirops.sga.net`)
- [ ] Confirmação de instalação de antivírus
- [ ] Confirmação de fonte SMTP (Hostinger externo ou interno SGA)

### 16.4 Início da Fase 1 (Preparação do Servidor)
- [ ] Instalar PostgreSQL 16 (EDB installer)
- [ ] Instalar Node.js 20 LTS (Windows MSI)
- [ ] Configurar IIS (URL Rewrite + ARR para reverse proxy)
- [ ] Criar estrutura de diretórios `D:\dirops\`
- [ ] Instalar NSSM
- [ ] Validar conectividade LDAP com AD

---

*Fim do documento. Próxima ação: gerar plano detalhado de execução por fases.*
