---
phase: 08-cache-integration-high-traffic
plan: "03"
subsystem: ui
tags: [tanstack-query, react-query, hooks, caching, dashboard, home, voos]

# Dependency graph
requires:
  - phase: 08-cache-integration-high-traffic/08-01
    provides: useDashboardStats, useVoos, useCalculosTarifa hooks with TanStack Query
  - phase: 07-query-optimization
    provides: get_dashboard_stats_full RPC returning { data, previousData } in single call

provides:
  - Home.jsx consuming dashboardStats and voos from TanStack Query hooks (no manual useEffect fetching)
  - getDashboardStats.js updated to use get_dashboard_stats_full RPC (replaces old Edge Function)

affects:
  - 08-02 (Operacoes.jsx migration — invalidateQueries at mutations will auto-refresh Home voos via shared queryKey)
  - 09 (remaining pages migration — same hook pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Home.jsx stats loading: useDashboardStats({ empresaId, aeroporto, periodo }) — queryKey changes on filter update trigger refetch"
    - "Home.jsx voos: useVoos({ empresaId }) — shared queryKey with Operacoes for cache deduplication"
    - "isLoadingAll = isLoading || isLoadingVoos — combines loadData gate with voos loading state"
    - "getDashboardStats uses RPC (not Edge Function): supabase.rpc('get_dashboard_stats_full', {...})"

key-files:
  created: []
  modified:
    - src/pages/Home.jsx
    - src/functions/getDashboardStats.js

key-decisions:
  - "useCalculosTarifa kept in Home.jsx: ReceitasChart still needs raw calculo_tarifa rows for revenue-over-time chart — not covered by RPC aggregate"
  - "getDashboardStats.js updated to RPC: Home.jsx was already using RPC directly (commit 24dad8c); hook must call same RPC to maintain consistency"
  - "voosLigados state kept as-is: plan scope is voos + dashboardStats only; voosLigados migration deferred to Phase 9"
  - "serverStats = dashboardStats: alias preserved for DashboardStats component prop compatibility"

patterns-established:
  - "Filter params (aeroporto, periodo) passed as queryKey args to useDashboardStats — React Query refetches automatically on param change, no useEffect needed"
  - "empresaId declared at component level (not inside loadData) — enables hook calls before async data loads"

requirements-completed: [INTEG-01]

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 8 Plan 03: Home.jsx TanStack Query Migration Summary

**Home dashboard migrated from manual useState/useEffect to useDashboardStats + useVoos + useCalculosTarifa hooks, with getDashboardStats updated to call get_dashboard_stats_full RPC instead of the deprecated Edge Function**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-25T21:50:00Z
- **Completed:** 2026-03-25T22:05:00Z
- **Tasks:** 1 auto + 1 checkpoint (auto-approved)
- **Files modified:** 2

## Accomplishments

- Removed `loadDashboardStats` useCallback + useEffect from Home.jsx — stats now auto-refetch via useDashboardStats when aeroporto/periodo filter changes
- Removed `Voo.list` and `CalculoTarifa.list` from `loadData()` — voos and calculos come from TanStack Query hooks
- Updated `getDashboardStats.js` to use `get_dashboard_stats_full` RPC (consistent with Home.jsx commit 24dad8c)
- Build exits 0, `loadDashboardStats` references = 0 in Home.jsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire useDashboardStats into Home.jsx, remove loadDashboardStats** - `6d339fd` (feat)
2. **Task 2: Verify Phase 8 end-to-end in browser** - auto-approved (checkpoint:human-verify)

## Files Created/Modified

- `src/pages/Home.jsx` - Removed loadDashboardStats, Voo.list, CalculoTarifa.list state/effects; added useDashboardStats, useVoos, useCalculosTarifa hook calls
- `src/functions/getDashboardStats.js` - Updated from Edge Function invoke to supabase.rpc('get_dashboard_stats_full') call

## Decisions Made

- `useCalculosTarifa` kept in Home.jsx because `ReceitasChart` needs raw calculo_tarifa rows for revenue-over-time visualization
- `getDashboardStats.js` updated to RPC to align with the already-committed Home.jsx RPC migration (commit 24dad8c)
- `serverStats` alias preserved (= dashboardStats) to avoid changing DashboardStats component props

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated getDashboardStats.js from Edge Function to RPC**
- **Found during:** Task 1 (Wire useDashboardStats into Home.jsx)
- **Issue:** getDashboardStats.js called `supabase.functions.invoke('get-dashboard-stats', ...)` but Home.jsx was already migrated in commit 24dad8c to use `supabase.rpc('get_dashboard_stats_full')`. The hook would invoke a stale Edge Function, returning wrong or empty data.
- **Fix:** Updated getDashboardStats.js to call `supabase.rpc('get_dashboard_stats_full', { p_empresa_id, p_aeroporto, p_dias })` with the correct parameter names
- **Files modified:** src/functions/getDashboardStats.js
- **Verification:** Build exits 0; useDashboardStats hook now calls same RPC as Home.jsx was using directly
- **Committed in:** 6d339fd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential fix — without it, useDashboardStats hook would call a deprecated Edge Function and return no data.

## Issues Encountered

- Worktree `agent-a47fb6aa` was at commit `24dad8c` (before Plan 01 hook commits). Cherry-picked `08418fc` and `7e21475` from `worktree-agent-ae22b2d4` branch to bring hooks into this worktree before executing Plan 03.

## Known Stubs

None — all data wiring is complete. useDashboardStats, useVoos, useCalculosTarifa return live data from Supabase.

## Next Phase Readiness

- Home.jsx migration complete
- Plan 02 (Operacoes.jsx migration + invalidateQueries) still pending — when completed, mutations in Operacoes will auto-refresh Home.jsx voos via shared `['voos', empresaId]` queryKey
- Phase 9 (remaining pages) can begin once Plan 02 is done

---
*Phase: 08-cache-integration-high-traffic*
*Completed: 2026-03-25*
