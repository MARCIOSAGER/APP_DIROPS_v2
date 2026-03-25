---
phase: 07-query-optimization
plan: "03"
subsystem: ui
tags: [react, tanstack-query, operacoes, tarifas, impostos, caching]

# Dependency graph
requires:
  - phase: 07-query-optimization/07-01
    provides: column-selective fetching via select param on entity list/filter
  - phase: 06-cache-foundation
    provides: tenant-safe query keys, useStaticData hooks, STATIC_CACHE_TIME constant

provides:
  - useImpostos hook in useStaticData.jsx (cached, tenant-isolated)
  - Operacoes.jsx tarifas/impostos served from TanStack Query cache instead of loadData()
  - 4 fewer network calls per Operacoes page load

affects: [08-cache-integration, phase-7-success-criteria]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useStaticData dynamic-import pattern: queryFn uses import('@/entities/X').then() to avoid circular deps"
    - "useEffect sync pattern: if (cache.length > 0) { const empId = ...; setState(filterTarifasByEmpresa(cache, empId)); }"

key-files:
  created: []
  modified:
    - src/components/lib/useStaticData.jsx
    - src/pages/Operacoes.jsx

key-decisions:
  - "Impostos use filterTarifasByEmpresa same as tarifas — consistent empresa_id scoping via sync effects"
  - "Direct entity imports (TarifaPouso, TarifaPermanencia, OutraTarifa, Imposto) removed from Operacoes.jsx — hooks replace all usages"

patterns-established:
  - "Pattern: All slow-changing reference tables use useStaticData hooks — add hook, wire sync effect, remove from loadData()"

requirements-completed: [QUERY-03]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 07 Plan 03: Query Optimization — Operacoes Tarifa/Imposto Deduplication Summary

**Eliminated 4 redundant network calls per Operacoes page load by wiring tarifas and impostos through TanStack Query cache hooks instead of loadData().**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-25T19:15:00Z
- **Completed:** 2026-03-25T19:27:18Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `useImpostos` export to `useStaticData.jsx` following the exact dynamic-import pattern of `useOutrasTarifas`, with tenant-safe query key `['impostos', effectiveEmpresaId]`
- Wired all four tarifa/imposto hooks in `Operacoes.jsx`: hook calls + four `useEffect` sync blocks that apply `filterTarifasByEmpresa` when cache data arrives
- Removed `TarifaPouso.filter`, `TarifaPermanencia.filter`, `OutraTarifa.filter`, and `Imposto.list` from `loadData()` Promise.allSettled — these 4 fetches no longer run on every page mount
- Removed now-unused direct entity imports for the four tarifa/imposto entities

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useImpostos to useStaticData.jsx** - `9f63ddf` (feat)
2. **Task 2: Wire four hooks in Operacoes.jsx, remove duplicate loadData fetches** - `e52678e` (feat)

## Files Created/Modified

- `src/components/lib/useStaticData.jsx` — Added `useImpostos` export (11 lines)
- `src/pages/Operacoes.jsx` — Wired 4 hooks, added 4 sync effects, removed 4 loadData fetches, removed 4 entity imports

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/lib/useStaticData.jsx` — useImpostos present at line 88
- `src/pages/Operacoes.jsx` — 16 cache references (4 hook calls + 4x3 lines in effects), 0 loadData tarifa/imposto fetch calls
- Commits `9f63ddf` and `e52678e` verified in git log
- `pnpm build` exits 0
