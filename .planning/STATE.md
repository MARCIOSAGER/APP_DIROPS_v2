---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Performance
status: Phase complete — ready for verification
stopped_at: Completed 07-03-PLAN.md
last_updated: "2026-03-25T19:29:10.260Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
---

# State: DIROPS-SGA

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Operations teams can manage flights end-to-end in a single unified system.
**Current focus:** Phase 07 — query-optimization

## Current Position

Phase: 07 (query-optimization) — EXECUTING
Plan: 3 of 3

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 8 pre-condition]: Operacoes.jsx mutation side effects not fully enumerated — map loadData() and refreshSpecificData() before migrating to TanStack Query hooks
- [Phase 10 pre-condition]: Actual pg_indexes state for voo, calculo_tarifa, voo_ligado is unknown — run audit query before writing migration

## Session Continuity

Last session: 2026-03-25T19:29:10.246Z
Stopped at: Completed 07-03-PLAN.md
Resume file: None
