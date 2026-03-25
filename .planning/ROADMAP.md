# Roadmap: DIROPS-SGA

## Milestones

- ✅ **v1.1 Consolidacao e Polimento** — Phases 1-5 (shipped 2026-03-25)
- 🚧 **v1.2 Performance** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.1 Consolidacao e Polimento (Phases 1-5) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Bug Fixes (2/2 plans) — PDF fix + FormVoo filter
- [x] Phase 2: FlightAware UI (2/2 plans) — Badges, real-flights toggle, duplicate detection + merge
- [x] Phase 3: FlightAware Automation (1/1 plan) — Daily pg_cron sync
- [x] Phase 4: Tech Debt (4/4 plans) — Permissions refactor + full i18n
- [x] Phase 5: UX Polish (3/3 plans) — Dashboard KPI, table scroll, form standardization

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.2 Performance (In Progress)

**Milestone Goal:** Eliminar lentidão percebida e necessidade de refreshes manuais no sistema em produção.

- [x] **Phase 6: Cache Foundation** - Tenant-safe cache keys, logout clearing, auth guard, and fetch timeout (completed 2026-03-25)
- [ ] **Phase 7: Query Optimization** - Column-selective fetching, dashboard RPC consolidation, Operacoes deduplication
- [ ] **Phase 8: Cache Integration (High-Traffic)** - TanStack Query hooks on Operacoes and Home with post-mutation invalidation
- [ ] **Phase 9: Cache Integration (Remaining) + Resilience** - Remaining pages migrated; ErrorBoundary for lazy chunks
- [ ] **Phase 10: Database Performance** - Composite indexes on primary query patterns

## Phase Details

### Phase 6: Cache Foundation
**Goal**: Caching is safe to extend — tenant isolation enforced in all query keys, cache cleared on logout, auth guard prevents ghost re-renders, and hung requests fail fast
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: CACHE-01, CACHE-02, CACHE-03, RES-02
**Success Criteria** (what must be TRUE):
  1. Switching empresa as superadmin immediately shows the new company's data — no stale data from the previous tenant visible
  2. After logout and re-login as a different user, no data from the previous session appears before fresh fetch completes
  3. Navigating between pages does not trigger a Supabase User.me() call — profile is read from AuthContext
  4. TOKEN_REFRESHED event does not cause a visible page re-render when the user identity is unchanged
  5. Any Supabase request that hangs for more than 15 seconds fails with an error state rather than loading indefinitely
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — Auth guard + logout cache clear + Supabase fetch timeout + query-client tuning
- [x] 06-02-PLAN.md — Fix useStaticData query keys to include effectiveEmpresaId (tenant isolation)
- [x] 06-03-PLAN.md — Replace User.me() with useAuth().user in all 23 pages

### Phase 7: Query Optimization
**Goal**: Pages fetch only the data they need — no redundant parallel calls, no full-table selects where column subsets suffice
**Depends on**: Phase 6
**Requirements**: QUERY-01, QUERY-02, QUERY-03
**Success Criteria** (what must be TRUE):
  1. The entity factory list() and filter() methods accept a select parameter so callers can specify columns instead of receiving all 30+ columns
  2. The Home dashboard issues a single RPC call for stats data instead of three separate fetches
  3. Operacoes page fetches tarifas and impostos exactly once per session via useStaticData — no duplicate fetch from loadData()
**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Add select param to _createEntity.js list() and filter()
- [ ] 07-02-PLAN.md — Collapse Home dashboard to single Edge Function stats call
- [ ] 07-03-PLAN.md — Wire useTarifasPouso/useTarifasPermanencia/useOutrasTarifas/useImpostos in Operacoes; remove loadData duplicates

### Phase 8: Cache Integration (High-Traffic)
**Goal**: Operacoes and Home use TanStack Query for all page-level data — changes made by the user appear immediately without a manual refresh
**Depends on**: Phase 7
**Requirements**: INTEG-01, INTEG-02
**Success Criteria** (what must be TRUE):
  1. After creating, editing, or deleting a flight in Operacoes, the flight list updates without pressing F5 or manually reloading
  2. After saving any flight mutation, the Home dashboard KPIs reflect the updated count on next navigation without a manual refresh
  3. Navigating away from Operacoes and back shows cached data instantly while a background refetch runs silently
  4. Operacoes and Home data fetches are deduplicated — both pages consume the same cached query result rather than each issuing their own network call
**Plans**: TBD
**UI hint**: yes

### Phase 9: Cache Integration (Remaining) + Resilience
**Goal**: All remaining pages serve data from TanStack Query cache, and the app recovers gracefully from ChunkLoadError after deploys
**Depends on**: Phase 8
**Requirements**: INTEG-03, RES-01
**Success Criteria** (what must be TRUE):
  1. Remaining pages that previously used raw useEffect fetches now reflect mutations without manual refresh
  2. After a production deploy, navigating to any lazy-loaded page that fails to load its chunk shows a recoverable error state rather than a blank screen
  3. Refreshing the page after a ChunkLoadError restores the page successfully
**Plans**: TBD
**UI hint**: yes

### Phase 10: Database Performance
**Goal**: Primary query patterns on voo, calculo_tarifa, and voo_ligado hit indexes instead of sequential scans — measurably faster at the database layer
**Depends on**: Phase 9
**Requirements**: DB-01
**Success Criteria** (what must be TRUE):
  1. EXPLAIN ANALYZE on the Operacoes primary voo query shows an index scan on empresa_id + deleted_at + data_operacao rather than a sequential scan
  2. EXPLAIN ANALYZE on the fetchCalculoMap query shows an index scan on calculo_tarifa(empresa_id, voo_id) rather than a sequential scan
  3. A new migration file is applied that adds the composite indexes without breaking existing queries or RLS policies
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bug Fixes | v1.1 | 2/2 | Complete | 2026-03-25 |
| 2. FlightAware UI | v1.1 | 2/2 | Complete | 2026-03-25 |
| 3. FlightAware Automation | v1.1 | 1/1 | Complete | 2026-03-25 |
| 4. Tech Debt | v1.1 | 4/4 | Complete | 2026-03-25 |
| 5. UX Polish | v1.1 | 3/3 | Complete | 2026-03-25 |
| 6. Cache Foundation | v1.2 | 3/3 | Complete   | 2026-03-25 |
| 7. Query Optimization | v1.2 | 0/3 | Not started | - |
| 8. Cache Integration (High-Traffic) | v1.2 | 0/? | Not started | - |
| 9. Cache Integration (Remaining) + Resilience | v1.2 | 0/? | Not started | - |
| 10. Database Performance | v1.2 | 0/? | Not started | - |
