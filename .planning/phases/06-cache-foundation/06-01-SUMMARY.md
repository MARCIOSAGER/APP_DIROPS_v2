---
phase: 06-cache-foundation
plan: "01"
subsystem: core-infra
tags: [supabase, tanstack-query, auth, cache, fetch-timeout, cors-user-data]

requires: []

provides:
  - Global 15s fetch timeout on all Supabase requests via AbortSignal.timeout(15000)
  - TanStack Query offlineFirst mode with reconnect refetch and tuned staleTime/gcTime
  - queryClientInstance.clear() on both logout() and SIGNED_OUT auth event
  - TOKEN_REFRESHED identity guard prevents ghost re-render mid-session

affects: [06-02, 06-03, 07-query-efficiency, 08-high-traffic-pages]

tech-stack:
  added: []
  patterns:
    - "Global fetch timeout: AbortSignal.timeout(15000) in supabaseClient global.fetch — applies to every Supabase request"
    - "Cache clear on logout: queryClientInstance.clear() before supabase.auth.signOut() — clears before session ends to avoid race"
    - "TOKEN_REFRESHED guard: only reload profile when session.user.id !== user?.id — prevents unnecessary DB call every ~55min"

key-files:
  created: []
  modified:
    - src/lib/supabaseClient.js
    - src/lib/query-client.js
    - src/lib/AuthContext.jsx

key-decisions:
  - "queryClientInstance.clear() called BEFORE supabase.auth.signOut() in logout() to avoid race where SIGNED_OUT handler fires while signOut is in-flight"
  - "TOKEN_REFRESHED guard uses closure value of user state — safe because user is always set before TOKEN_REFRESHED can fire, and same user keeps same user.id"
  - "staleTime increased from 2min to 3min and gcTime from 10min to 15min — tuned for slower connectivity environments typical of airport operations"

requirements-completed: [CACHE-02, RES-02]

duration: 8min
completed: 2026-03-25
---

# Phase 06 Plan 01: Cache Foundation — Fetch Timeout, QueryClient Tuning, Auth Cache Clearing

**15s AbortSignal.timeout on all Supabase requests prevents indefinite hangs; queryClientInstance.clear() on logout eliminates cross-user data leakage on shared terminals; TOKEN_REFRESHED identity guard prevents ghost re-renders mid-session**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T17:58:42Z
- **Completed:** 2026-03-25T18:06:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `global.fetch` override to supabaseClient.js with `AbortSignal.timeout(15000)` — every Supabase request now aborts after 15 seconds instead of hanging indefinitely
- Updated query-client.js: staleTime 3min (was 2min), gcTime 15min (was 10min), added `networkMode: 'offlineFirst'` to queries and mutations, added `refetchOnReconnect: true`
- Added `import { queryClientInstance } from '@/lib/query-client'` to AuthContext.jsx
- Added `queryClientInstance.clear()` in `logout()` function before `supabase.auth.signOut()` — prevents race condition
- Added `queryClientInstance.clear()` in `SIGNED_OUT` event handler — second safety net for direct session expiry
- Added TOKEN_REFRESHED identity guard: `if (session.user.id !== user?.id)` — skips `loadUserProfile` DB call when same user refreshes token

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 15s fetch timeout to supabaseClient and tune query-client defaults** - `22fb826` (feat)
2. **Task 2: Add queryClient.clear() on logout and guard TOKEN_REFRESHED in AuthContext** - `12509ca` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/supabaseClient.js` - Added `global.fetch` with `AbortSignal.timeout(15000)`
- `src/lib/query-client.js` - Added `networkMode: 'offlineFirst'`, `refetchOnReconnect: true`, increased staleTime to 3min, gcTime to 15min
- `src/lib/AuthContext.jsx` - Added queryClientInstance import, .clear() in logout() and SIGNED_OUT handler, TOKEN_REFRESHED identity guard

## Decisions Made

- `queryClientInstance.clear()` placed BEFORE `supabase.auth.signOut()` in `logout()`: this prevents a race where the SIGNED_OUT auth event fires during the signOut in-flight and the SIGNED_OUT handler runs while clear() hasn't executed yet. Clearing first is safe — no in-flight queries need their cache after logout starts.
- TOKEN_REFRESHED guard uses `user` closure value (React state): safe because `user` is always populated during the initial SIGNED_IN before TOKEN_REFRESHED can fire. The useEffect dependency array remains `[loadUserProfile]` unchanged to avoid infinite loops.
- `networkMode: 'offlineFirst'` chosen over `'online'` (default): serves stale cache data when offline rather than rejecting queries with a network error — better UX for intermittent connectivity at airports.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CACHE-02 (auth cache clearing) is now complete: logout and SIGNED_OUT both clear the query cache
- RES-02 (fetch timeout) is now complete: 15s AbortSignal.timeout on all Supabase requests
- Phase 06-02 (CACHE-01 tenant query keys) and Phase 06-03 can build on this foundation
- Phase 7 (query efficiency) can now add useQuery hooks knowing cache clearing is correctly handled

## Self-Check: PASSED

- `src/lib/supabaseClient.js` — FOUND: contains `AbortSignal.timeout(15000)`
- `src/lib/query-client.js` — FOUND: contains `networkMode: 'offlineFirst'` (2 locations)
- `src/lib/AuthContext.jsx` — FOUND: contains `queryClientInstance.clear()` (2 locations) and `session.user.id !== user?.id`
- Commit `22fb826` — FOUND
- Commit `12509ca` — FOUND
- Build — PASSED (dist directory populated)

---

*Phase: 06-cache-foundation*
*Completed: 2026-03-25*
