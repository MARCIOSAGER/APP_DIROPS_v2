---
phase: 07-query-optimization
plan: "01"
subsystem: api
tags: [supabase, query, select, optimization, entities]

requires:
  - phase: 06-cache-foundation
    provides: TanStack Query cache layer that calls _createEntity.js methods

provides:
  - select parameter on list() and filter() in _createEntity.js
  - Callers can request specific columns to reduce payload size

affects: [08-operacoes-migration, 09-remaining-pages, any page using list() or filter()]

tech-stack:
  added: []
  patterns:
    - "Optional select param with default '*' — backward-compatible column projection on list() and filter()"

key-files:
  created: []
  modified:
    - src/entities/_createEntity.js

key-decisions:
  - "Default select='*' ensures all existing callers continue to receive all columns without modification"
  - "Follows paginate() pattern already established in the same file"

patterns-established:
  - "Column projection pattern: pass select string to list()/filter()/paginate() to limit returned columns"

requirements-completed: [QUERY-01]

duration: 10min
completed: 2026-03-25
---

# Phase 07 Plan 01: Query Optimization — Select Param Summary

**Added optional `select` parameter to `list()` and `filter()` in `_createEntity.js` so callers can request specific columns and reduce payload size on large tables like `voo`**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-25T19:15:23Z
- **Completed:** 2026-03-25T19:25:24Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `list(orderBy, limit, select='*')`: callers can now pass a column projection string
- `filter(filters, orderBy, limit, skip, select='*')`: same capability for filtered queries
- All existing callers unaffected — default `'*'` keeps backward compatibility
- Pattern aligned with existing `paginate()` which already had `select` support

## Task Commits

1. **Task 1: Add select param to list() and filter()** - `2482d84` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `src/entities/_createEntity.js` - Added `select = '*'` param to `list()` and `filter()` signatures; both now call `.select(select)` instead of `.select('*')`

## Decisions Made

- Default `'*'` is the only correct choice — changing the default would silently break all existing callers
- No callers updated in this plan — that is intentional; callers opt in to column projection when they need it

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File exists: `/d/VSCode_Claude/01-Projetos/APP_DIROPS/APP_DIROPS_v2/src/entities/_createEntity.js` — FOUND
- Commit `2482d84` — FOUND (verified via git log)
- 3 lines with `select = '*'` in file (list, filter, paginate) — VERIFIED
- 0 hardcoded `.select('*')` remaining in list/filter — VERIFIED
- Build exit 0 — VERIFIED
