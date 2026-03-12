# PROPOSTA COMERCIAL
# Sistema DIROPS-SGA v2.0
# Sistema de Gestao Aeroportuaria

---

## 1. Apresentacao

O **DIROPS-SGA** e um sistema web completo de gestao de operacoes aeroportuarias,
desenvolvido sob medida para atender as necessidades operacionais da Direccao
de Operacoes (DIROPS) da SGA - Sociedade Gestora de Aeroportos.

O sistema centraliza e automatiza os processos operacionais, substituindo
controles manuais e planilhas por uma plataforma digital integrada,
acessivel por qualquer navegador web.

---

## 2. Modulos e Funcionalidades

### 2.1 Gestao de Voos
- Registo e acompanhamento de voos (chegadas, partidas, escalas)
- Integracao com dados FlightRadar24
- Calculo automatico de tarifas de pouso e permanencia
- Gestao de voos ligados (conexoes)
- Proformas e faturacao

### 2.2 Gestao de Reclamacoes
- Formulario publico para passageiros e utilizadores
- Fluxo de tratamento com historico completo
- Notificacoes automaticas por email
- Relatorios e metricas de atendimento

### 2.3 Credenciamento
- Formulario publico de solicitacao
- Fluxo de aprovacao multi-nivel
- Controle de areas de acesso
- Gestao de validade e renovacao

### 2.4 Seguranca e Safety (SGSO)
- Registo de ocorrencias de safety
- Classificacao por tipo e gravidade
- Planos de acao corretiva
- Acompanhamento de resolucao

### 2.5 Auditorias e Inspecoes
- Criacao de tipos de auditoria e inspecao
- Checklists personalizaveis
- Registo de respostas e evidencias
- Planos de acao corretiva (PAC)

### 2.6 KPIs e Indicadores
- Definicao de indicadores por area
- Medicoes periodicas
- Dashboards com graficos
- Preparado para integracao com Power BI

### 2.7 Gestao Financeira
- Calculo de tarifas (pouso, permanencia, outras)
- Gestao de impostos
- Movimentos financeiros
- Registos GRF

### 2.8 Gestao Documental
- Organizacao por pastas e categorias
- Upload e download de documentos
- Controle de versoes
- Log de acessos

### 2.9 Ordens de Servico
- Abertura e acompanhamento
- Categorizacao por tipo
- Atribuicao de responsaveis
- Historico completo

### 2.10 Chatbot com Inteligencia Artificial (SIGA)
- Assistente virtual integrado ao sistema
- Respostas baseadas em IA (OpenAI/Anthropic)
- Sistema de tickets de suporte
- Base de conhecimento operacional

### 2.11 Gestao de Usuarios e Permissoes
- Perfis de acesso (administrador, gestor, operador, etc.)
- Permissoes por aeroporto
- Solicitacao e aprovacao de acessos
- Notificacoes automaticas

### 2.12 Notificacoes e Comunicacao
- Notificacoes por email (SMTP)
- Regras de notificacao configuraveis
- Templates personalizaveis
- Preparado para integracao WhatsApp (ZAPI)

---

## 3. Tecnologias Utilizadas

| Componente | Tecnologia |
|------------|-----------|
| Frontend | React 18 + Vite 6 + Tailwind CSS |
| Componentes UI | Radix UI (acessivel, responsivo) |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticacao | Supabase Auth (JWT, sessoes seguras) |
| Storage | Supabase Storage (uploads de arquivos) |
| Edge Functions | Deno Runtime (email, chatbot, etc.) |
| Seguranca | DOMPurify (XSS), RLS (Row Level Security) |

---

## 4. Proposta Financeira

### Opcao A - Licenciamento Unico (Entrega do Projeto)

Entrega completa do sistema com codigo-fonte, documentacao e instalacao.

| Item | Valor (USD) | Valor (Kz) |
|------|-------------|------------|
| Licenca do software (codigo-fonte completo) | $15.000 | 13.200.000 Kz |
| Instalacao e configuracao no servidor | $3.000 | 2.640.000 Kz |
| Migracao de dados (Base44 -> novo sistema) | $2.000 | 1.760.000 Kz |
| Treinamento da equipa (remoto, 8h) | $1.500 | 1.320.000 Kz |
| Documentacao tecnica e operacional | $1.000 | 880.000 Kz |
| **Total** | **$22.500** | **19.800.000 Kz** |

**Inclui:**
- Codigo-fonte completo e irrestrito
- Direito de uso perpetuo
- 3 meses de suporte tecnico pos-implantacao
- Correcao de bugs durante o periodo de suporte
- Documentacao completa (tecnica + usuario)

### Opcao B - Licenciamento Mensal (SaaS)

O sistema e disponibilizado como servico, com hospedagem e manutencao inclusos.

| Item | Valor Mensal (USD) | Valor Mensal (Kz) |
|------|-------------------|-------------------|
| Licenca de uso | $800 | 704.000 Kz |
| Hospedagem e infraestrutura | Incluso | Incluso |
| Backups diarios | Incluso | Incluso |
| Suporte tecnico | Incluso | Incluso |
| Updates e melhorias | Incluso | Incluso |
| **Total mensal** | **$800** | **704.000 Kz/mes** |

**Setup inicial (unico):**

| Item | Valor (USD) | Valor (Kz) |
|------|-------------|------------|
| Instalacao e configuracao | $3.000 | 2.640.000 Kz |
| Migracao de dados | $2.000 | 1.760.000 Kz |
| Treinamento (remoto, 8h) | $1.500 | 1.320.000 Kz |
| **Total setup** | **$6.500** | **5.720.000 Kz** |

**Inclui:**
- Hospedagem em nuvem (alta disponibilidade)
- Backups automaticos diarios
- Suporte tecnico por email e chat
- Correcao de bugs e vulnerabilidades
- Updates do sistema
- Monitoramento 24/7

### Opcao C - Por Aeroporto (Multi-site)

Para implantacao em multiplos aeroportos da SGA.

| Quantidade | Valor por aeroporto/mes (USD) | Valor por aeroporto/mes (Kz) |
|------------|------------------------------|------------------------------|
| 1 aeroporto | $800 | 704.000 Kz |
| 2-5 aeroportos | $600 | 528.000 Kz |
| 6-10 aeroportos | $450 | 396.000 Kz |
| 10+ aeroportos | Sob consulta | Sob consulta |

---

## 5. Servicos Adicionais (Opcionais)

| Servico | Valor (USD) | Valor (Kz) |
|---------|-------------|------------|
| Customizacao de funcionalidades (por hora) | $100/h | 88.000 Kz/h |
| Desenvolvimento de novos modulos (por hora) | $120/h | 105.600 Kz/h |
| Integracao com Power BI (dashboards) | $3.000 | 2.640.000 Kz |
| Integracao com WhatsApp (ZAPI) | $2.000 | 1.760.000 Kz |
| Treinamento adicional (por sessao de 4h) | $800 | 704.000 Kz |
| Suporte tecnico estendido (apos 3 meses) | $500/mes | 440.000 Kz/mes |
| Consultoria em infraestrutura (rede interna) | $150/h | 132.000 Kz/h |

---

## 6. Custos Operacionais (por conta da SGA)

Independente da opcao escolhida, existem custos de servicos terceiros:

| Servico | Custo Estimado | Observacao |
|---------|---------------|------------|
| IA - Chatbot | 2.500 - 4.500 Kz/mes | Depende do volume de uso |
| Power BI (licencas) | Depende da SGA | Se ja tiver, custo zero |
| Supabase Pro (se necessario) | 22.000 Kz/mes | Apenas se ultrapassar limites free |
| Dominio + SSL | 0 - 3.500 Kz/mes | Depende do cenario de hosting |

---

## 7. Condicoes Comerciais

### Forma de Pagamento

**Opcao A (Licenciamento Unico):**
- 40% na assinatura do contrato
- 30% na entrega e instalacao
- 30% apos validacao e aceite final

**Opcao B (SaaS):**
- Setup: 100% antes da instalacao
- Mensalidade: faturacao mensal, pagamento ate o dia 10

**Opcao C (Multi-site):**
- Setup: 50% na assinatura, 50% na entrega
- Mensalidade: faturacao mensal por aeroporto

### Prazo de Entrega

| Etapa | Prazo |
|-------|-------|
| Inicio apos assinatura | Imediato |
| Instalacao e configuracao | 1-3 dias uteis |
| Migracao de dados | 1 dia util |
| Treinamento | Agendado com a equipa |
| **Total** | **5-7 dias uteis** |

### Validade da Proposta

Esta proposta tem validade de **30 dias** a partir da data de emissao.

### Garantia

- 3 meses de garantia sobre defeitos e bugs (todas as opcoes)
- Correcoes de seguranca durante todo o periodo de contrato
- SLA de resposta: 24h uteis para suporte tecnico

---

## 8. Contato

- **Responsavel:** [Nome]
- **Email:** [email]
- **Telefone:** [telefone]
- **Website:** [website]

---

*Proposta Comercial - DIROPS-SGA v2.0*
*Data de Emissao: Marco 2026*
*Validade: 30 dias*

**Nota:** Valores em Kwanzas calculados com base no cambio de 1 USD = 880 Kz.
Os valores em USD prevalecem em caso de variacao cambial.
