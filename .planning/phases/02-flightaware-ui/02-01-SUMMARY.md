---
phase: 02-flightaware-ui
plan: "01"
subsystem: operacoes/flightaware-ui
tags: [flightaware, badges, ui, filter, cache]
dependency_graph:
  requires: []
  provides: [FA-origin-badge, verification-badges, real-flights-toggle, atualizado-status]
  affects: [src/components/operacoes/VoosTable.jsx, src/components/operacoes/CacheVooFlightAwareList.jsx]
tech_stack:
  added: []
  patterns: [tailwind-peer-checkbox-toggle, stackable-badges]
key_files:
  created: []
  modified:
    - src/components/operacoes/VoosTable.jsx
    - src/components/operacoes/CacheVooFlightAwareList.jsx
decisions:
  - "Use pure CSS/Tailwind peer checkbox pattern for toggle — avoids new Radix Switch dependency"
  - "voosReaisMatch uses actual_off/actual_on (not datetime_takeoff/datetime_landed) per D-06 spec"
metrics:
  duration: "245s"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 01: FlightAware Visual Indicators Summary

Blue "Dados FlightAware" badge replaces small "FA" label in flight list; amber verification badges retained; cache list gains "Apenas voos reais" toggle (OFF by default) with actual_off/actual_on filter and atualizado status with blue styling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add "Dados FlightAware" badge in VoosTable | 418bb25 | src/components/operacoes/VoosTable.jsx |
| 2 | Add real flights toggle and atualizado to CacheVooFlightAwareList | 46aacc3 | src/components/operacoes/CacheVooFlightAwareList.jsx |

## What Was Built

### Task 1 — VoosTable.jsx badge update

Replaced the small sky-colored "FA" badge (border-sky-400 text-sky-600) with a full "Dados FlightAware" blue info badge (border-blue-400 text-blue-700 bg-blue-50) in the numero_voo cell. The existing amber verification badges were confirmed correct and unchanged:
- "Verificar Registo" — shown when `isFA && !voo.registo_aeronave`
- "Verificar Horario" — shown when `isFA && !voo.horario_previsto`

All 3 badges appear in different table cells and can stack simultaneously on the same row.

### Task 2 — CacheVooFlightAwareList.jsx enhancements

Four changes in one file:
1. Added `atualizado` key to `statusColors` with blue styling (`bg-blue-50`, `text-blue-800`, `bg-blue-100 text-blue-800`)
2. Added `filtroVoosReais` state initialized to `false` (OFF by default per D-05)
3. Added `voosReaisMatch` filter: `!filtroVoosReais || ((rawData.actual_off || rawData.actual_on) && !rawData.cancelled)`
4. Added "Apenas voos reais" toggle switch (Tailwind peer-checkbox pattern) in filter bar
5. Added `atualizado` option to status filter dropdown
6. Added `setFiltroVoosReais(false)` to clear filters handler

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data sources are wired (filter reads actual_off/actual_on from raw_data, statusColors reads voo.status).

## Verification

- VoosTable.jsx: "Dados FlightAware" badge with blue styling present ✓
- VoosTable.jsx: old ">FA<" badge removed ✓
- VoosTable.jsx: amber Verificar Registo and Verificar Horario badges retained ✓
- CacheVooFlightAwareList.jsx: filtroVoosReais state (false default) ✓
- CacheVooFlightAwareList.jsx: voosReaisMatch in filter chain ✓
- CacheVooFlightAwareList.jsx: actual_off/actual_on filter logic ✓
- CacheVooFlightAwareList.jsx: "Apenas voos reais" toggle UI ✓
- CacheVooFlightAwareList.jsx: atualizado in statusColors (bg-blue-50) ✓
- CacheVooFlightAwareList.jsx: atualizado in status dropdown ✓
- CacheVooFlightAwareList.jsx: setFiltroVoosReais(false) in clear handler ✓
- App builds without errors ✓

## Self-Check: PASSED

- src/components/operacoes/VoosTable.jsx: FOUND
- src/components/operacoes/CacheVooFlightAwareList.jsx: FOUND
- .planning/phases/02-flightaware-ui/02-01-SUMMARY.md: FOUND
- Commit 418bb25 (Task 1): FOUND
- Commit 46aacc3 (Task 2): FOUND
- Commit 00377a0 (Docs): FOUND
