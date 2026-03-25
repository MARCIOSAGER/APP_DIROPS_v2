---
phase: 07-query-optimization
plan: "02"
subsystem: dashboard
tags: [performance, query-optimization, edge-function, home-dashboard]
dependency_graph:
  requires: []
  provides: [single-stats-fetch]
  affects: [src/pages/Home.jsx]
tech_stack:
  added: []
  patterns: [single-edge-function-call, response-previousData-pattern]
key_files:
  modified:
    - src/pages/Home.jsx
decisions:
  - "Response.previousData used for trend comparison — Edge Function already returns previous-period stats in same response, eliminating the need for a second getDashboardStats call"
  - "serverStats removed — was a fallback for an RPC call that duplicated Edge Function data; dashboardStats values used directly in trends"
metrics:
  duration: 689s
  completed: "2026-03-25T19:26:37Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 07 Plan 02: Dashboard Stats Consolidation Summary

**One-liner:** Collapsed three parallel stats fetches (two Edge Function calls + one RPC) into a single `getDashboardStats()` call using `response.previousData` for trends.

## What Was Built

Refactored `loadDashboardStats()` in `src/pages/Home.jsx` to issue exactly one network request for dashboard statistics. Previously, the function fired three parallel calls — two `getDashboardStats()` invocations (current period + double period for trend comparison) and one `supabase.rpc('get_dashboard_stats')` call. The Edge Function already returns both `data` (current period) and `previousData` (previous period) in a single response, making the two redundant calls unnecessary.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Collapse three stats calls to one in loadDashboardStats | c44b85f | src/pages/Home.jsx |

## Changes Made

**src/pages/Home.jsx:**
- Removed `Promise.all([...])` with three parallel calls in `loadDashboardStats()`
- Replaced with single `const response = await getDashboardStats(params)` call
- Changed `setDashboardStats(response.data)` (unchanged) and `setPreviousPeriodStats(response.previousData)` (was `prevResponse.data`)
- Removed `const [serverStats, setServerStats] = useState(null)` state declaration
- Removed `previousPeriodo` variable declaration
- Removed `setServerStats(rpcResult)` and `setServerStats(null)` in catch block
- Updated `trends` useMemo: replaced `serverStats?.total_voos ?? dashboardStats.totalVoos` pattern with direct `dashboardStats.totalVoos` (and equivalent for pontualidade/passageiros)
- Removed `serverStats` from `trends` useMemo dependencies array
- Removed `serverStats={serverStats}` prop from `DashboardStats` component
- Supabase import retained — still used by `get_receita_por_companhia` RPC call in separate `loadReceita()` effect

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -c "getDashboardStats" src/pages/Home.jsx` = 2 (import + one call)
- `grep "serverStats" src/pages/Home.jsx` = 0 lines
- `grep "supabase\.rpc" src/pages/Home.jsx` = 1 line (get_receita_por_companhia, unrelated)
- `grep "previousPeriodo" src/pages/Home.jsx` = 0 lines
- `pnpm build` exited 0 (built in ~68s)

## Self-Check: PASSED

- File modified: src/pages/Home.jsx — confirmed present
- Commit c44b85f — confirmed in git log
