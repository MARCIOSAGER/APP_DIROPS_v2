# Roadmap: DIROPS-SGA

## Milestones

- 🚧 **v1.1 Consolidacao e Polimento** - Phases 1-5 (in progress)

## Overview

Milestone v1.1 consolidates the production system by fixing critical bugs, completing FlightAware UI enhancements and automation, eliminating tech debt (hardcoded permissions, incomplete i18n), and polishing the UX across major pages. Phases flow from highest-impact fixes to lowest-risk polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bug Fixes** - Resolve critical PDF and FormVoo linking errors blocking users
- [ ] **Phase 2: FlightAware UI** - Verification badges, filters, duplicate detection, and merge on flight list
- [ ] **Phase 3: FlightAware Automation** - Scheduled daily fetch to keep cache current without manual action
- [ ] **Phase 4: Tech Debt** - Permissions refactor and complete i18n across remaining components
- [ ] **Phase 5: UX Polish** - Dashboard, tables, and form modals consistent and polished

## Phase Details

### Phase 1: Bug Fixes
**Goal**: Users can generate all PDF reports and link arrival flights in FormVoo without errors
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02
**Success Criteria** (what must be TRUE):
  1. User can generate PDF report in "Todas as Companhias" grouped mode and receives a valid file without error
  2. User opening FormVoo sees "Voo de Chegada Vinculado" dropdown populated with ARR flights filtered by empresa, date before departure, and same registration
  3. Selecting a linked arrival flight saves correctly and displays the association in the flight detail view
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix PDF returnBase64 arguments anti-pattern (BUG-01)
- [x] 01-02-PLAN.md — Add registration filter to voosArrDisponíveis in FormVoo (BUG-02)

### Phase 2: FlightAware UI
**Goal**: Users can identify FlightAware-sourced flights, spot missing data, detect duplicates, and update existing flights from the import flow
**Depends on**: Phase 1
**Requirements**: FA-01, FA-02, FA-03, FA-04, FA-06, FA-07
**Success Criteria** (what must be TRUE):
  1. Flights imported from FlightAware with empty registration show a visible "Verificar Registo" badge on the flight list
  2. Flights with empty horario_previsto show a visible "Verificar Horarios" badge on the flight list
  3. FlightAware automatic imports are visually distinguished from manual entries with a "Dados FlightAware" badge
  4. User can toggle a filter on the FlightAware cache to show only real flights (actual_off/actual_on present, cancelled hidden)
  5. Import modal shows a warning when the selected flight already exists in the system, and user can choose to update the existing flight with FlightAware data instead of creating a duplicate
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Badges (Dados FlightAware, Verificar Registo/Horario) + real-flights toggle filter (FA-01, FA-02, FA-03, FA-04)
- [x] 02-02-PLAN.md — Duplicate detection warning + field-level merge modal (FA-06, FA-07)

**UI hint**: yes

### Phase 3: FlightAware Automation
**Goal**: FlightAware cache stays current daily without requiring any manual user action
**Depends on**: Phase 2
**Requirements**: FA-05
**Success Criteria** (what must be TRUE):
  1. System automatically fetches FlightAware data once per day via a scheduled function
  2. Newly fetched flights appear in the cache and are available for import without the user triggering a manual fetch
**Plans**: 1 plan

Plans:
- [~] 03-01-PLAN.md — Daily FlightAware sync function + pg_cron schedule (FA-05) [awaiting human-verify]

### Phase 4: Tech Debt
**Goal**: All page access checks use regra_permissao and all user-facing strings support both PT and EN
**Depends on**: Phase 1
**Requirements**: DEBT-01, DEBT-02
**Success Criteria** (what must be TRUE):
  1. No page in the app uses hardcoded profile role checks — all access gates query regra_permissao
  2. Switching the app to EN displays English strings in all previously Portuguese-only components (~120 files)
  3. Adding a new role to regra_permissao automatically grants or restricts access to all guarded pages without code changes
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Add isAdminProfile helper + replace hardcoded role checks in 11 pages (DEBT-01)
- [ ] 04-02-PLAN.md — i18n for 10 high-traffic operational pages (DEBT-02)
- [ ] 04-03-PLAN.md — i18n for 21 remaining pages (DEBT-02)
- [ ] 04-04-PLAN.md — i18n for 34 domain components — dashboard, documentos, financeiro, servicos, shared (DEBT-02)

### Phase 5: UX Polish
**Goal**: Dashboard, data tables, and form modals present information consistently and are usable on common screen sizes
**Depends on**: Phase 2, Phase 4
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Dashboard KPI layout uses consistent typography and spacing without misaligned cards or overlapping text
  2. Data tables in Operacoes, Faturacao, and other major pages are readable and usable on standard laptop screen widths
  3. Form modals (FormVoo, proforma, safety) have consistent field spacing, button placement, and error state styling
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in order: 1 → 2 → 3 → 4 → 5
Note: Phase 4 depends only on Phase 1 (can start after Phase 1 completes, in parallel with Phases 2-3 if desired).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bug Fixes | 1/2 | In Progress|  |
| 2. FlightAware UI | 1/2 | In Progress|  |
| 3. FlightAware Automation | 0/1 | In Progress | - |
| 4. Tech Debt | 0/4 | Not started | - |
| 5. UX Polish | 0/? | Not started | - |
