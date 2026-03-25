# DIROPS-SGA

## What This Is

Airport management system (DIROPS-SGA) for managing flights, invoicing, safety, inspections, maintenance, audits, and credentials. Multi-tenant (empresa_id) with role-based access. Migrated from Base44 BaaS to self-hosted Supabase. Currently in production.

## Core Value

Operations teams can manage flights end-to-end — from arrival through departure, invoicing, and reporting — in a single unified system.

## Current Milestone: v1.1 Consolidacao e Polimento

**Goal:** Corrigir bugs, completar FlightAware, eliminar tech debt e polir UX do sistema em producao.

**Target features:**
- Correcao de bugs criticos (PDF agrupado, FormVoo vinculacao)
- FlightAware: badges de verificacao, filtro voos reais, busca automatica diaria
- Remover hardcoded admin checks (usar regra_permissao)
- Completar i18n PT/EN nos ~120 componentes restantes
- Melhorias UX/UI gerais (dashboard, tabelas, modais)

## Requirements

### Validated

- ✓ Flight CRUD with voo_ligado (ARR+DEP linking) — v1.0
- ✓ Proforma/invoicing with cumulative tariff calculations — v1.0
- ✓ Safety occurrences management — v1.0
- ✓ Inspections and maintenance (SS/OS) — v1.0
- ✓ Audit management with PACs — v1.0
- ✓ Credentialing system — v1.0
- ✓ Multi-tenant with empresa_id isolation — v1.0
- ✓ Auth with role-based permissions (regra_permissao) — v1.0
- ✓ Dashboard with KPIs and Top 10 airlines — v1.0
- ✓ FlightAware AeroAPI integration (import, FIDS, cache) — v1.0
- ✓ i18n PT/EN (partial — nav, pages, major modules) — v1.0
- ✓ External API for Power BI (data-api Edge Function) — v1.0
- ✓ PDF generation for invoices and extracts — v1.0
- ✓ Email notifications via SMTP — v1.0
- ✓ Supabase Storage for uploads — v1.0
- ✓ Soft-delete with trash (Lixeira) — v1.0
- ✓ Server-side filtering (8/10 pages) — v1.0
- ✓ Complaints management (Reclamacoes) — v1.0
- ✓ Airport services (ServicosAeroportuarios) — v1.0
- ✓ Petty cash (FundoManeio) — v1.0

### Active

- [x] Fix PDF "Todas as Companhias" grouped mode error — Phase 1
- [x] Fix FormVoo "Voo de Chegada Vinculado" dropdown filter — Phase 1
- [ ] FlightAware verification badges on flight list
- [ ] FlightAware filter for "real" flights in cache
- [ ] FlightAware automatic daily fetch (cron/scheduled)
- [ ] Replace hardcoded admin checks with regra_permissao
- [ ] Complete i18n for remaining ~120 component files
- [ ] UX/UI improvements (dashboard, tables, modals)

### Out of Scope

- Mobile native app — web-first, responsive sufficient for now
- Real-time chat/messaging — not needed for operations workflow
- New modules — focus is consolidation, not expansion

## Context

- Stack: React 18 + Vite 6 + Tailwind + Radix UI + Supabase
- Hosting: Hostinger (SSH deploy to app.marciosager.com)
- Supabase: dirops-sga project (Sao Paulo region)
- GitHub: MARCIOSAGER/APP_DIROPS_v2 (public)
- Entity adapters use factory pattern (_createEntity.js) with pagination
- Base44 compatibility layer in src/api/base44Client.js
- 49 database migrations applied
- regra_permissao: administrador (27 pages), operacoes (17 pages)

## Constraints

- **Stack**: React 18 + Supabase — no framework changes
- **Hosting**: Hostinger shared hosting — static deploy only
- **Multi-tenant**: All queries must respect empresa_id isolation
- **Permissions**: Must use regra_permissao table, not hardcoded checks
- **i18n**: All user-facing strings must support PT/EN

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate from Base44 to Supabase | Base44 limitations, need for self-hosted control | ✓ Good |
| Factory pattern for entities (_createEntity.js) | Consistent CRUD across all tables with pagination | ✓ Good |
| Base44 compatibility layer (Proxy) | Minimize code changes during migration | ✓ Good |
| FlightAware AeroAPI over FR24 | Better data quality, official API, /history/ support | ✓ Good |
| RPC for FIDS data | Efficient server-side join for flight display board | ✓ Good |
| Multi-tenant via empresa_id | Support ATO + SGA + future companies | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 1 completion (Bug Fixes)*
