---
phase: 01-bug-fixes
plan: 02
subsystem: ui
tags: [react, useMemo, vitest, tdd, flight-operations]

# Dependency graph
requires: []
provides:
  - filterVoosArr pure helper exported from FormVoo.jsx
  - Registration-based filtering for voosArrDisponíveis dropdown
  - Unit tests for voosArrDisponíveis filter logic (3 tests)
affects: [flight-form, voo-ligado, operacoes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract useMemo filter logic into exported pure helper for testability"
    - "Add VITE_SUPABASE_URL/KEY env vars to vitest test config for isolation"

key-files:
  created:
    - src/components/operacoes/__tests__/FormVooVoosArr.test.js
  modified:
    - src/components/operacoes/FormVoo.jsx
    - vite.config.js

key-decisions:
  - "Extract filterVoosArr as named export (not module-private) to allow direct unit testing without component rendering"
  - "Use individual formData.* fields in useMemo dep array to match existing code style (not whole formData object)"
  - "Registration filter is conditional on formData.registo_aeronave being non-empty — new DEP flights without registration still show all date-eligible ARRs"

patterns-established:
  - "Pattern: Extract useMemo filter logic into exported pure helper for testability without full component mount"

requirements-completed: [BUG-02]

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 01 Plan 02: FormVoo Registration Filter for Linked Arrival Dropdown Summary

**voosArrDisponíveis now filters ARR flights by aircraft registration match (BUG-02), with exported filterVoosArr pure helper and 3 passing unit tests via TDD**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-25T13:47:00Z
- **Completed:** 2026-03-25T13:54:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Exported `filterVoosArr` pure helper from FormVoo.jsx for direct unit testing
- Added aircraft registration filter: when DEP flight has a known registration, only ARR flights with matching registration appear in the linked arrival dropdown
- Added `formData.registo_aeronave` to the useMemo dependency array to prevent stale value usage
- Created 3 passing unit tests covering: registration match, empty registration (no-op), and date filter regression guard
- Fixed vitest test environment to define VITE_SUPABASE_URL/KEY so tests don't fail on Supabase initialization

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test scaffold (RED)** - `e3b5d73` (test)
2. **Task 2: Add registration filter (GREEN)** - `c4b8ba9` (feat)

_Note: TDD tasks — test (RED) committed first, then implementation (GREEN)_

## Files Created/Modified

- `src/components/operacoes/__tests__/FormVooVoosArr.test.js` - 3 unit tests for filterVoosArr (registration filter, empty registration, date regression guard)
- `src/components/operacoes/FormVoo.jsx` - Exported filterVoosArr pure helper, replaced inline useMemo with helper call, added formData.registo_aeronave to dependency array
- `vite.config.js` - Added VITE_SUPABASE_URL/KEY test env vars to prevent Supabase initialization failure in unit tests

## Decisions Made

- Extracted `filterVoosArr` as a **named export** (not module-private) to allow direct unit testing without mounting the full FormVoo component — avoids needing complex React Testing Library setup for a pure filter function
- Used individual `formData.*` fields in the useMemo dependency array to match the existing code style in the file
- Registration filter is **conditional** on `formData.registo_aeronave` being non-empty — new DEP flights without a registration typed yet still show all date-eligible ARR flights, preserving the original behavior for incomplete forms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added VITE_SUPABASE_URL/KEY to vitest test config**

- **Found during:** Task 1 (test scaffold creation)
- **Issue:** Importing `FormVoo.jsx` in tests triggered the import chain `FormVoo → notificacoes.jsx → supabaseClient.js → createClient(undefined, undefined)` which throws a URL validation error, preventing tests from running at all
- **Fix:** Added `env: { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY }` to the `test` section in `vite.config.js` so `import.meta.env` is populated during test runs
- **Files modified:** `vite.config.js`
- **Verification:** Tests ran and failed with the expected `filterVoosArr is not a function` (RED state confirmed)
- **Committed in:** `e3b5d73` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix to make tests runnable in the worktree environment. No scope creep.

## Issues Encountered

- Vitest test environment in the worktree had no `.env` file, causing Supabase client initialization to fail when `FormVoo.jsx` was imported. Fixed by adding test env vars to `vite.config.js`.
- Pre-existing `tariffCalculators.test.js` failures (2 tests) were present before any changes — confirmed out-of-scope and not caused by this plan's changes.

## Known Stubs

None - all logic is fully wired. The `filterVoosArr` function is a real implementation, not a stub.

## Next Phase Readiness

- BUG-02 is resolved: the voosArrDisponíveis dropdown now correctly filters by aircraft registration
- Test infrastructure improvement (vitest env vars) benefits any future tests that import components with Supabase dependencies
- No blockers for subsequent plans

---
*Phase: 01-bug-fixes*
*Completed: 2026-03-25*
