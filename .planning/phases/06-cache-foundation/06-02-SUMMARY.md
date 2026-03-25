---
phase: 06-cache-foundation
plan: "02"
subsystem: ui
tags: [react, tanstack-query, caching, multi-tenant, empresa-id]

requires:
  - phase: 06-cache-foundation-01
    provides: TanStack Query provider installed and QueryClientProvider wrapping the app

provides:
  - Tenant-isolated query keys in all 7 useStaticData hooks (aeroportos, companhias, aeronaves, modelos, tarifas-pouso, tarifas-permanencia, outras-tarifas)
  - Superadmin empresa-switching no longer serves stale data from previous tenant

affects: [07-query-efficiency, 08-high-traffic-pages, phase-7, phase-8, phase-9]

tech-stack:
  added: []
  patterns:
    - "Tenant-scoped query keys: include effectiveEmpresaId as 2nd element in all queryKey arrays for multi-tenant cached data"
    - "useCompanyView() at hook top: every cached hook destructures effectiveEmpresaId from useCompanyView() before useQuery"

key-files:
  created: []
  modified:
    - src/components/lib/useStaticData.jsx

key-decisions:
  - "Query key isolation only (no queryFn filter): empresa_id added to key only — queryFn bodies unchanged. Supabase RLS handles row-level isolation; key change prevents cache collisions between tenants"

patterns-established:
  - "Tenant query key pattern: ['resource-name', effectiveEmpresaId] — apply to all future hooks for tenant-scoped data"

requirements-completed: [CACHE-01]

duration: 6min
completed: 2026-03-25
---

# Phase 06 Plan 02: CACHE-01 Tenant Query Key Isolation Summary

**effectiveEmpresaId added to all 7 useStaticData query keys — superadmin empresa-switching now creates separate TanStack Query cache entries per tenant, eliminating silent stale-data cross-tenant bug**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T17:59:17Z
- **Completed:** 2026-03-25T18:05:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `import { useCompanyView } from '@/lib/CompanyViewContext'` to useStaticData.jsx
- All 7 hooks now call `const { effectiveEmpresaId } = useCompanyView()` at their top
- Every queryKey changed from flat string `['aeroportos']` to tenant-scoped `['aeroportos', effectiveEmpresaId]`
- Build passes (exit 0), ESLint clean — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add effectiveEmpresaId to all useStaticData query keys** - `a5beb7a` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/lib/useStaticData.jsx` - Added useCompanyView import + effectiveEmpresaId in all 7 query keys

## Decisions Made

- Query key isolation only (no queryFn filter): the `queryFn` bodies were NOT changed to pass `effectiveEmpresaId` to entity methods. Supabase RLS already isolates rows by authenticated user's empresa_id at the server. The key change purely prevents TanStack Query from serving Empresa A's cached data to an Empresa B view — this is intentional and correct. Phase 7 may add explicit queryFn filtering as an optimization.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CACHE-01 complete: useStaticData hooks are tenant-isolated
- Phase 06-03 (CACHE-02 logout cache clearing) can now proceed safely
- Phase 7 (query efficiency) can extend caching to more data knowing the tenant key pattern is established

---

*Phase: 06-cache-foundation*
*Completed: 2026-03-25*
