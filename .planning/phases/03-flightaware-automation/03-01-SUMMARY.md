---
phase: 03-flightaware-automation
plan: 01
subsystem: database/automation
tags: [flightaware, pg_cron, migration, postgresql, automation]
dependency_graph:
  requires: [051_fetch_fr24_history_support.sql, cache_voo_f_r24 table, aeroporto table]
  provides: [sync_flightaware_daily() function, flightaware-daily-sync cron job]
  affects: [cache_voo_f_r24]
tech_stack:
  added: [pg_cron]
  patterns: [PL/pgSQL SECURITY DEFINER function, ON CONFLICT upsert, cron.schedule]
key_files:
  created:
    - supabase/migrations/052_sync_flightaware_daily_fn.sql
    - supabase/migrations/053_schedule_flightaware_daily.sql
  modified: []
decisions:
  - GET DIAGNOSTICS ROW_COUNT used per-flight to count actual upserts (including skipped importado)
  - NULLIF pattern used for COALESCE on datetime fields to avoid empty-string cast errors
  - Exception handler at function level returns partial summary with fatal error key
metrics:
  duration: ~60s
  completed_date: "2026-03-25"
  tasks_completed: 2/3
  files_created: 2
status: awaiting-checkpoint
---

# Phase 3 Plan 1: FlightAware Daily Automation Summary

**One-liner:** PL/pgSQL sync_flightaware_daily() function + pg_cron schedule at 03:00 UTC for automatic daily FlightAware cache refresh.

## What Was Built

Two SQL migrations implementing scheduled FlightAware cache automation:

**Migration 052** (`sync_flightaware_daily()`):
- Loops all `aeroporto.codigo_icao` entries
- For each airport, calls `fetch_fr24()` twice: yesterday's window + today's window
- Upserts each returned flight into `cache_voo_f_r24` via `ON CONFLICT (fr24_id) DO UPDATE`
- Skips overwriting flights with `status = 'importado'` (import-lock guard)
- Skips rows where `fr24_id` is NULL or empty
- Returns JSONB summary: `{ "airports_processed": N, "flights_upserted": N, "errors": [...] }`
- RAISE NOTICE on per-airport errors (continues loop rather than aborting)

**Migration 053** (pg_cron schedule):
- Enables `pg_cron` extension (idempotent via `IF NOT EXISTS`)
- Idempotent unschedule block using `DO $$ ... END $$` pattern
- Schedules `flightaware-daily-sync` at `0 3 * * *` (03:00 UTC daily)
- Comment block with verify/manual-trigger/disable instructions

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create sync_flightaware_daily() function | Done | 7eb697b |
| 2 | Schedule daily sync with pg_cron | Done | e017cac |
| 3 | Verify migrations applied in Supabase | Awaiting human verification | - |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical handling] Added NULLIF guards for empty datetime strings**
- **Found during:** Task 1 implementation
- **Issue:** `fetch_fr24()` may return empty string `""` for datetime fields. Direct `COALESCE(flight->>'datetime_landed', ...)::date` would throw on empty string cast.
- **Fix:** Used `NULLIF(flight->>'datetime_landed', '')` inside COALESCE chain so empty strings are treated as NULL before casting to date.
- **Files modified:** `supabase/migrations/052_sync_flightaware_daily_fn.sql`
- **Commit:** 7eb697b

## Known Stubs

None — both migrations are complete SQL, no placeholder logic.

## Awaiting Checkpoint

Task 3 requires human action in the Supabase dashboard:
1. Apply migration 052 in SQL editor
2. Test `SELECT sync_flightaware_daily();` manually
3. Enable pg_cron extension in Supabase Dashboard
4. Apply migration 053 in SQL editor
5. Verify `SELECT * FROM cron.job WHERE jobname = 'flightaware-daily-sync';`

See plan Task 3 for full step-by-step instructions.

## Self-Check

### Files Created

- [x] `/d/VSCode_Claude/01-Projetos/APP_DIROPS/APP_DIROPS_v2/supabase/migrations/052_sync_flightaware_daily_fn.sql`
- [x] `/d/VSCode_Claude/01-Projetos/APP_DIROPS/APP_DIROPS_v2/supabase/migrations/053_schedule_flightaware_daily.sql`

### Commits

- [x] `7eb697b` — feat(03-01): create sync_flightaware_daily() PL/pgSQL function
- [x] `e017cac` — feat(03-01): schedule sync_flightaware_daily() via pg_cron at 03:00 UTC
