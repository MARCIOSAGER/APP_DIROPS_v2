---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Performance
status: Milestone complete
stopped_at: Completed 10-01-PLAN.md (auth gate on migration apply)
last_updated: "2026-03-26T07:23:38.331Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 10
---

# State: DIROPS-SGA

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Operations teams can manage flights end-to-end in a single unified system.
**Current focus:** Phase 10 — database-performance

## Current Position

Phase: 10
Plan: Not started

## Performance Metrics

**Velocity (v1.1 reference):**

- Total plans completed (v1.1): 12
- Average duration: ~280s/plan
- Total execution time: ~56 min

**By Phase (v1.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 06-cache-foundation P02 | 6 | 1 tasks | 1 files |
| Phase 06-cache-foundation P01 | 8 | 2 tasks | 3 files |
| Phase 06 P03 | 35 | 1 tasks | 23 files |
| Phase 07-query-optimization P01 | 10 | 1 tasks | 1 files |
| Phase 07-query-optimization P02 | 689 | 1 tasks | 1 files |
| Phase 07-query-optimization P03 | 12 | 2 tasks | 2 files |
| Phase 08-cache-integration-high-traffic P01 | 446 | 2 tasks | 4 files |
| Phase 08-cache-integration-high-traffic P02 | 1557 | 2 tasks | 5 files |
| Phase 09-cache-integration-remaining-resilience P03 | 278 | 1 tasks | 1 files |
| Phase 09 P01 | 692 | 2 tasks | 3 files |
| Phase 09-cache-integration-remaining-resilience P02 | 32 | 2 tasks | 3 files |
| Phase 10-database-performance P01 | 1500 | 1 tasks | 1 files |

## Accumulated Context

### Decisions

- v1.2 correctness-first: Cache tenant keys (CACHE-01) and logout clearing (CACHE-02) must ship in Phase 6 before extending caching to any additional pages — silent wrong-data bugs, not errors
- v1.2 migration order: Phase 6 (safe foundation) → Phase 7 (query efficiency) → Phase 8 (high-traffic pages Operacoes/Home) → Phase 9 (remaining pages + resilience) → Phase 10 (DB indexes after query patterns stable)
- Operacoes.jsx risk: Has 3-attempt custom retry logic in loadData(); Phase 8 planning must audit all mutation side effects before migrating
- DB indexes: Phase 10 requires EXPLAIN ANALYZE before writing any migration — actual slow queries may differ from expected patterns
- [Phase 06-cache-foundation]: Query key isolation only (no queryFn filter): empresa_id added to key only — queryFn bodies unchanged. Supabase RLS handles row-level isolation; key change prevents cache collisions between tenants in useStaticData hooks
- [Phase 06-cache-foundation]: queryClientInstance.clear() before supabase.auth.signOut() in logout() prevents race with SIGNED_OUT handler
- [Phase 06-cache-foundation]: TOKEN_REFRESHED guard: session.user.id !== user?.id skips DB call — same user token refresh does not reload profile
- [Phase 06]: Operacoes.jsx uses currentUser = user alias to avoid cascading prop name changes across child components
- [Phase 06]: ensureUserProfilesExist called inline at component level (not in loadData) so normalized profile is synchronously available throughout component lifecycle
- [Phase 07-query-optimization]: Default select='*' on list()/filter() keeps all existing callers backward compatible while enabling opt-in column projection
- [Phase 07-query-optimization]: Response.previousData used for trend comparison — Edge Function already returns previous-period stats in same response, eliminating the need for a second getDashboardStats call
- [Phase 07-query-optimization]: Impostos use filterTarifasByEmpresa same as tarifas — consistent empresa_id scoping via sync effects
- [Phase 08-cache-integration-high-traffic]: staleTime 0 for operational hooks (voos/voosLigados/calculos), staleTime 5 min for aggregate stats (dashboard) — operational data must always reflect server state on mount
- [Phase 08-cache-integration-high-traffic]: fetchCalculoMap exported separately from useCalculosTarifa so Plans 02/03 can call it imperatively after mutations without triggering full re-render cycle
- [Phase 08-cache-integration-high-traffic]: useDashboardStats returns full response object (not destructured): callers access both .data and .previousData at call site
- [Phase 08-cache-integration-high-traffic]: Plan 01 hooks missing — created as prerequisite blocking deviation before Plan 02 migration
- [Phase 08-cache-integration-high-traffic]: handleBuscarVoos/handleBuscarLigados use queryClient.setQueryData to override cache with filtered search results
- [Phase 08-cache-integration-high-traffic]: Mutation pattern established: await entity.mutate → queryClient.invalidateQueries({ queryKey: ['key', empresaId] })
- [Phase 09-cache-integration-remaining-resilience]: ErrorBoundary outer placement in App() covers AuthenticatedApp inner Suspense via React tree propagation — no duplicate boundary needed for RES-01
- [Phase 09]: makeEntityQuery factory: staleTime:0 for operational pages, handleBuscar uses setQueryData to override cache with filtered results
- [Phase 09-cache-integration-remaining-resilience]: Pastas (Pasta entity) uses separate useQuery(['pastas', empresaId]) with staleTime 0 — no useStaticData hook and operational data that can change
- [Phase 09-cache-integration-remaining-resilience]: TipoInspecao in Inspecoes.jsx uses staleTime 5min — reference data (rarely changes), consistent with useStaticData pattern
- [Phase 10-database-performance]: Migration 055 uses CREATE INDEX CONCURRENTLY to avoid table locks on production — each statement run as separate API call
- [Phase 10-database-performance]: 3-column composite (empresa_id, deleted_at, data_operacao DESC) covers Operacoes WHERE + ORDER BY; calculo_tarifa composite (empresa_id, voo_id) enables index-only scan for fetchCalculoMap

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 8 pre-condition]: Operacoes.jsx mutation side effects not fully enumerated — map loadData() and refreshSpecificData() before migrating to TanStack Query hooks
- [Phase 10 pre-condition]: Actual pg_indexes state for voo, calculo_tarifa, voo_ligado is unknown — run audit query before writing migration

## Session Continuity

Last session: 2026-03-26T07:19:28.362Z
Stopped at: Completed 10-01-PLAN.md (auth gate on migration apply)
Resume file: None
