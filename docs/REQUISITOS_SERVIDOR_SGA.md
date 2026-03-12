# DIROPS-SGA - Requisitos de Infraestrutura

## 1. Resumo do Sistema

O DIROPS-SGA e um sistema web de gestao aeroportuaria composto por:
- **Frontend** - interface web (HTML/CSS/JavaScript)
- **Banco de dados** - PostgreSQL
- **Autenticacao** - gerenciamento de usuarios e sessoes
- **API REST** - comunicacao entre frontend e banco
- **Storage** - armazenamento de arquivos (uploads)
- **Edge Functions** - funcoes auxiliares (chatbot, emails, etc.)

Este documento apresenta **dois cenarios de implantacao** para a equipe de TI da SGA
escolher de acordo com a politica de infraestrutura da organizacao.

---

# CENARIO A: Rede Externa (Cloud)

Neste cenario, o sistema fica acessivel pela internet atraves de um dominio publico.
O banco de dados e servicos ficam na nuvem (Supabase Cloud).
A SGA precisa apenas de um hosting para servir os arquivos do frontend.

## A.1 Arquitetura

```
Usuarios (navegador)
    |
    | https://dirops.sga.xx (internet)
    |
[Hosting Web] -----> Arquivos estaticos (HTML/CSS/JS)
    |
    | HTTPS (API)
    |
[Supabase Cloud] --> Banco PostgreSQL + Auth + Storage + Functions
```

## A.2 Requisitos da SGA

| Item | Detalhes |
|------|----------|
| **Hosting web** | Qualquer servico que sirva arquivos estaticos |
| **Dominio** | Subdominio ou dominio proprio (ex: dirops.sga.xx) |
| **SSL** | Certificado HTTPS (geralmente incluso no hosting) |
| **SMTP** (opcional) | Para envio de emails de notificacao |

### Opcoes de Hosting

| Opcao | Custo | Complexidade |
|-------|-------|-------------|
| Hosting compartilhado (Hostinger, cPanel) | Baixo (~3.500 Kz/mes) | Minima |
| VPS (Ubuntu + Nginx) | Medio (~8.500 Kz/mes) | Media |
| Vercel / Netlify / Cloudflare Pages | Gratis | Minima |

### Servicos na Nuvem (ja configurados)

| Servico | Plataforma | Custo |
|---------|-----------|-------|
| Banco PostgreSQL | Supabase Cloud | Gratis (ate 500MB) |
| Autenticacao | Supabase Auth | Gratis (ate 50.000 usuarios) |
| Storage | Supabase Storage | Gratis (ate 1GB) |
| Edge Functions | Supabase Functions | Gratis (ate 500.000 chamadas/mes) |

## A.3 Vantagens e Desvantagens

**Vantagens:**
- Manutencao minima (Supabase cuida do banco, backups, updates)
- Deploy simples (upload de arquivos estaticos)
- Sem necessidade de servidor dedicado
- Backups automaticos do banco

**Desvantagens:**
- Dados armazenados fora da rede da SGA
- Depende de conexao com internet
- Se o uso crescer muito, Supabase Pro custa $25/mes (~22.000 Kz)

## A.4 Checklist para a SGA (Cenario A)

- [ ] Hosting web contratado ou disponivel
- [ ] Dominio/subdominio definido
- [ ] DNS apontando para o hosting
- [ ] Certificado SSL configurado
- [ ] Dados do SMTP fornecidos (se quiserem email)

---

# CENARIO B: Rede Interna (Self-Hosted)

Neste cenario, **tudo roda dentro de um servidor na rede interna da SGA**.
Nenhum dado sai da rede. Nao depende de internet.
Utiliza o Supabase Self-Hosted (open-source, via Docker).

## B.1 Arquitetura

```
Usuarios (navegador na rede interna)
    |
    | https://dirops.sga.local (rede interna)
    |
[Servidor SGA - Nginx]
    |
    |--- /            --> Frontend (arquivos estaticos)
    |--- /rest/       --> Supabase PostgREST (API)
    |--- /auth/       --> Supabase GoTrue (autenticacao)
    |--- /storage/    --> Supabase Storage (uploads)
    |--- /functions/  --> Supabase Edge Functions
    |--- /realtime/   --> Supabase Realtime (websockets)
    |
[Docker Compose - Supabase Stack]
    |
    |--- PostgreSQL (banco de dados)
    |--- GoTrue (autenticacao)
    |--- PostgREST (API REST automatica)
    |--- Storage API (uploads de arquivos)
    |--- Edge Functions (funcoes serverless)
    |--- Kong (API Gateway)
```

## B.2 Requisitos do Servidor

### Hardware Minimo

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Disco | 50 GB SSD | 100 GB SSD |
| Rede | IP fixo na rede interna | - |

### Sistema Operacional

- **Ubuntu Server 22.04 LTS** (recomendado)
- Alternativas: Debian 12, Rocky Linux 9

### Software Necessario

| Software | Versao Minima | Comando de Verificacao |
|----------|---------------|----------------------|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ | `docker compose version` |
| Nginx | 1.18+ | `nginx -v` |
| Git | 2.30+ | `git --version` |
| Node.js | 18+ | `node --version` |

### Portas Internas

| Porta | Servico | Observacao |
|-------|---------|------------|
| 80 | HTTP | Redireciona para 443 |
| 443 | HTTPS | Acesso principal ao sistema |
| 5432 | PostgreSQL | Apenas se quiserem acesso direto ao banco |

**IMPORTANTE:** Nenhuma porta precisa estar aberta para a internet.

## B.3 Rede e DNS Interno

O sistema precisa de um endereco acessivel na rede interna:

- **Opcao A (recomendado):** Subdominio interno - ex: `dirops.sga.local`
- **Opcao B:** IP fixo do servidor - ex: `https://192.168.1.100`

Se optarem pelo subdominio, configurar no DNS interno:
```
dirops.sga.local  -->  IP_DO_SERVIDOR
```

## B.4 Certificado SSL (HTTPS)

Para HTTPS na rede interna:
- **Certificado autoassinado** (mais simples)
- **Certificado da CA interna da SGA** (se tiverem autoridade certificadora)
- **Sem SSL** (apenas HTTP - funciona, mas nao recomendado)

## B.5 Email (SMTP)

O sistema envia emails para notificacoes, convites e alertas.

**Se a SGA tiver servidor SMTP interno**, fornecer:
- Host (ex: `smtp.sga.local`)
- Porta (587 ou 465)
- Usuario e senha
- Endereco de envio (ex: `dirops@sga.xx`)

**Se nao tiver SMTP:** o sistema funciona normalmente, apenas sem envio de emails.

## B.6 Espaco em Disco Estimado

| Componente | Tamanho |
|------------|---------|
| Docker images (Supabase stack) | ~3 GB |
| Banco de dados (inicial) | ~100 MB |
| Frontend (arquivos estaticos) | ~50 MB |
| Logs e backups | ~2 GB (cresce) |
| **Total inicial** | **~5 GB** |
| **Reserva para crescimento** | **30-50 GB** |

## B.7 Backup

Recomendacoes:
- **Banco de dados:** backup diario automatizado (pg_dump)
- **Arquivos enviados:** backup da pasta de uploads
- **Retencao:** manter ultimos 30 dias

Scripts de backup automatizado serao entregues junto com a instalacao.

## B.8 Vantagens e Desvantagens

**Vantagens:**
- Controle total sobre os dados
- Sem dependencia de internet
- Sem custos recorrentes de nuvem
- Conformidade com politicas de seguranca internas

**Desvantagens:**
- Requer servidor dedicado
- Manutencao do Docker/Supabase pela equipe de TI
- Updates de seguranca sao responsabilidade da SGA
- Backup e responsabilidade da SGA

## B.9 Checklist para a SGA (Cenario B)

- [ ] Servidor disponibilizado (Ubuntu 22.04 LTS)
- [ ] Docker e Docker Compose instalados
- [ ] Nginx instalado
- [ ] Git e Node.js instalados
- [ ] IP fixo atribuido ao servidor
- [ ] DNS interno configurado (se aplicavel)
- [ ] Portas 80 e 443 abertas no firewall interno
- [ ] Acesso SSH disponibilizado (usuario com permissao sudo)
- [ ] Dados do SMTP fornecidos (se aplicavel)
- [ ] Politica de backup definida (local de armazenamento)

---

# Comparativo entre Cenarios

| Aspecto | Cenario A (Cloud) | Cenario B (Rede Interna) |
|---------|-------------------|--------------------------|
| **Onde ficam os dados** | Supabase Cloud (AWS) | Servidor interno da SGA |
| **Depende de internet** | Sim | Nao |
| **Servidor necessario** | Nao (apenas hosting) | Sim (4+ cores, 8+ GB RAM) |
| **Manutencao** | Minima | Media (Docker, updates) |
| **Custo mensal** | 0-3.500 Kz (hosting) | 0 Kz (hardware ja existente) |
| **Tempo de instalacao** | 1-2 horas | 4-6 horas |
| **Backup** | Automatico (Supabase) | Manual (scripts fornecidos) |
| **Seguranca de dados** | Nuvem (criptografado) | Rede interna (controle total) |
| **Escalabilidade** | Alta (Supabase escala) | Limitado ao hardware |

---

# Acesso Necessario para Instalacao

Independente do cenario escolhido, para realizar a instalacao preciso de:

### Cenario A (Cloud)
| Item | Detalhes |
|------|----------|
| Acesso ao painel do hosting | Para upload dos arquivos |
| Acesso ao DNS | Para configurar o dominio |

### Cenario B (Rede Interna)
| Item | Detalhes |
|------|----------|
| Acesso SSH ao servidor | Usuario com permissao sudo |
| IP do servidor | IP fixo na rede interna |
| DNS interno (se aplicavel) | Subdominio configurado |
| Dados do SMTP (se aplicavel) | Host, porta, usuario, senha |

---

# O que Sera Entregue

| Entregavel | Descricao |
|------------|-----------|
| Codigo-fonte completo | Repositorio Git do frontend |
| Scripts de deploy | Instalacao automatizada |
| Configuracao Docker | docker-compose.yml (Cenario B) |
| Configuracao Nginx | Reverse proxy (Cenario B) |
| Migrations do banco | Schema completo do PostgreSQL |
| Scripts de migracao | Importacao de dados do sistema atual |
| Scripts de backup | Backup automatizado (Cenario B) |
| Documentacao tecnica | Manual de operacao e manutencao |

---

# Cronograma Estimado

| Etapa | Cenario A | Cenario B |
|-------|-----------|-----------|
| Preparacao do servidor/hosting (SGA) | 1 dia | 1-2 dias |
| Instalacao e configuracao | 1-2 horas | 4-6 horas |
| Deploy do frontend | 30 min | 30 min |
| Migracao de dados | 1 hora | 1 hora |
| Testes e validacao | 2 horas | 3 horas |
| Criacao de usuarios | 1 hora | 1 hora |
| **Total (apos infra pronta)** | **~0.5 dia** | **~1 dia** |

---

# Custos Recorrentes Estimados

Alem da infraestrutura, o sistema utiliza servicos externos que podem ter custos
dependendo do volume de uso.

## Inteligencia Artificial (Chatbot SIGA)

O chatbot utiliza APIs de IA para responder perguntas dos usuarios.

| Provedor | Modelo | Custo por conversa | Estimativa mensal (500 conversas) |
|----------|--------|-------------------|----------------------------------|
| OpenAI | GPT-4o-mini | ~9 Kz/conversa | ~4.500 Kz/mes |
| OpenAI | GPT-4o | ~45 Kz/conversa | ~22.500 Kz/mes |
| Anthropic | Claude Haiku | ~5 Kz/conversa | ~2.500 Kz/mes |
| Anthropic | Claude Sonnet | ~27 Kz/conversa | ~13.500 Kz/mes |

**Nota:** O modelo pode ser configurado conforme a necessidade.
Modelos mais baratos (GPT-4o-mini, Haiku) sao suficientes para a maioria dos casos.

**Cenario B (Rede Interna):** Se a SGA nao tiver acesso a internet no servidor,
o chatbot pode ser desactivado ou substituido por um modelo local (ex: Ollama),
sem custo, mas com qualidade inferior.

## Power BI (Business Intelligence)

Para dashboards e relatorios conectados ao banco de dados.

| Item | Detalhes | Custo |
|------|----------|-------|
| **Conector** | PostgreSQL (nativo no Power BI) | Gratis |
| **Power BI Pro** | Por usuario que cria/visualiza relatorios | ~8.800 Kz/usuario/mes |
| **Power BI Premium** | Capacidade dedicada (para muitos usuarios) | ~17.500 Kz/usuario/mes |
| **Power BI Desktop** | Criacao de relatorios (uso individual) | Gratis |

**Cenario A (Cloud):** Power BI conecta ao Supabase via connection string PostgreSQL.
Necessario habilitar "Direct Connection" no Supabase (disponivel no plano Pro).

**Cenario B (Rede Interna):** Power BI conecta diretamente ao PostgreSQL do servidor.
Conexao simples, sem custo adicional alem da licenca Power BI.

**Nota:** Se a SGA ja possuir licencas Power BI, nao ha custo adicional para o conector.

## Supabase (apenas Cenario A - Cloud)

| Plano | Limite | Custo |
|-------|--------|-------|
| **Free** | 500 MB banco, 1 GB storage, 50K usuarios | 0 Kz |
| **Pro** | 8 GB banco, 100 GB storage, sem limites | ~22.000 Kz/mes |

O sistema atualmente utiliza ~40 MB de banco. O plano Free e suficiente
para operacao normal. O Pro so seria necessario se o volume de dados
crescer significativamente ou se precisar da conexao direta para Power BI.

## Resumo de Custos Mensais Estimados

### Cenario A (Cloud) - Uso moderado

| Servico | Custo Mensal |
|---------|-------------|
| Hosting (frontend) | 0 - 3.500 Kz |
| Supabase (banco + auth) | 0 Kz (Free) |
| IA - Chatbot (500 conversas, modelo basico) | ~2.500 - 4.500 Kz |
| Power BI (se ja tiver licenca) | 0 Kz |
| **Total estimado** | **2.500 - 8.000 Kz/mes** |

### Cenario B (Rede Interna) - Uso moderado

| Servico | Custo Mensal |
|---------|-------------|
| Servidor (hardware ja existente) | 0 Kz |
| IA - Chatbot (requer internet ou modelo local) | 0 - 4.500 Kz |
| Power BI (se ja tiver licenca) | 0 Kz |
| **Total estimado** | **0 - 4.500 Kz/mes** |

**Nota:** Valores estimados com base no cambio de 1 USD = ~880 Kz (Marco 2026).
Os custos reais podem variar conforme o volume de uso e cambio vigente.

---

# Contato

Para duvidas sobre os requisitos ou instalacao:

- **Responsavel:** [Nome]
- **Email:** [email]
- **Telefone:** [telefone]

---

*Documento: DIROPS-SGA v2.0 - Requisitos de Infraestrutura*
*Data: Marco 2026*
