---
phase: 02-flightaware-ui
plan: "02"
subsystem: operacoes/flightaware-import
tags: [flightaware, duplicate-detection, merge-modal, import-flow]
dependency_graph:
  requires: [02-01]
  provides: [duplicate-warning, merge-modal, forceCreate-import, selective-field-merge]
  affects: [src/components/operacoes/VooFlightAwareReviewModal.jsx, src/components/operacoes/VooFlightAwareMergeModal.jsx, src/components/operacoes/CacheVooFlightAwareList.jsx, src/functions/importVooFromFlightAwareCache.js]
tech_stack:
  added: []
  patterns: [early-return-for-duplicate, selective-merge-pattern, 3-button-action-bar]
key_files:
  created:
    - src/components/operacoes/VooFlightAwareMergeModal.jsx
  modified:
    - src/components/operacoes/VooFlightAwareReviewModal.jsx
    - src/components/operacoes/CacheVooFlightAwareList.jsx
    - src/functions/importVooFromFlightAwareCache.js
decisions:
  - "importVooFromFlightAwareCache returns early with existingVoo+faData when no selectedFields (backward compat)"
  - "forceCreate=true bypasses duplicate check entirely to support Criar Novo flow"
  - "Merge only fills empty fields (never overwrites) — enforced via !existing[field] check in loop"
  - "Fixed typo: 'actualizado' -> 'atualizado' in cache status update"
metrics:
  duration: "420s"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 02: FlightAware Duplicate Detection and Merge Summary

Duplicate detection warning with 3-button action bar added to review modal; new side-by-side merge modal with cherry-pick checkboxes; import function extended with selectedFields selective merge and forceCreate bypass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add duplicate warning with 3-button action bar and merge modal | 7313db0 | VooFlightAwareReviewModal.jsx, VooFlightAwareMergeModal.jsx (new), importVooFromFlightAwareCache.js |
| 2 | Wire duplicate action flow in CacheVooFlightAwareList | 04a2609 | CacheVooFlightAwareList.jsx |

## What Was Built

### Task 1 — Duplicate warning, merge modal, import function changes

**A. importVooFromFlightAwareCache.js:**
- Added `selectedFields` (array) and `forceCreate` (boolean) parameters to function signature
- When duplicate found and `selectedFields` NOT provided: returns early with `{ success: true, duplicado: true, existingVoo, faData, message }` — backward compatible (existing callers unaffected)
- When `forceCreate === true`: bypasses duplicate block entirely, proceeds to create new flight
- When `selectedFields` IS provided: selective merge — only fills empty fields in existing voo for chosen fields
- Fixed typo: `'actualizado'` → `'atualizado'` in cache status update (D-10 compliance)
- All FA data computed into `allPossible` object before branching to avoid code duplication

**B. VooFlightAwareMergeModal.jsx (new file):**
- Props: `{ existingVoo, faData, cacheVooId, onClose, onMergeComplete }`
- Computes `mergeableFields` = fields where FA has value AND existing is empty
- Side-by-side comparison table: checkbox | Campo | Valor Atual | Valor FlightAware
- Green-50 rows for mergeable fields, slate-50 for non-mergeable (visual distinction)
- Disabled checkboxes for non-empty existing fields (never overwrites)
- "Selecionar todos disponiveis (N)" convenience link
- Footer: Cancelar + "Atualizar N campo(s)" button (disabled when 0 selected or merging)
- Calls `importVooFromFlightAwareCache({ cacheVooId, selectedFields })` on merge

**C. VooFlightAwareReviewModal.jsx:**
- Added `AlertTriangle` to lucide-react imports
- Added `onDuplicateAction` prop to component signature
- Replaced old `VooFlightAwareComparisonRow` duplicate section with amber warning banner
- Banner shows: warning icon, "Voo ja existe no sistema" heading, explanation text
- 3 action buttons: "Atualizar Existente" (calls `onDuplicateAction('merge', ...)`), "Criar Novo" (calls `onDuplicateAction('create', ...)`), "Cancelar" (calls `onClose`)
- Wrapped footer buttons with `{!suggestions?.voo_duplicado && (...)}` to hide Confirmar Importacao when duplicate found

### Task 2 — CacheVooFlightAwareList wiring

- Added imports: `VooFlightAwareMergeModal`, `importVooFromFlightAwareCache`
- Added state: `showMergeModal` (false), `mergeData` (null)
- `handleDuplicateAction(action, duplicateInfo)`:
  - `'merge'`: closes review modal, populates `mergeData`, opens merge modal
  - `'create'`: calls `importVooFromFlightAwareCache({ cacheVooId, forceCreate: true })`, shows success, reloads
- `handleMergeComplete(result)`: closes merge modal, clears state, shows success toast, reloads list
- Updated `VooFlightAwareReviewModal` JSX to pass `onDuplicateAction={handleDuplicateAction}`
- Added `VooFlightAwareMergeModal` render block after review modal block

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired: merge modal reads existingVoo/faData from props (populated by handleDuplicateAction), merge calls real importVooFromFlightAwareCache, status updates hit real Supabase.

## Verification

- importVooFromFlightAwareCache accepts `selectedFields` parameter ✓
- importVooFromFlightAwareCache accepts `forceCreate` parameter ✓
- importVooFromFlightAwareCache returns `existingVoo` and `faData` when duplicate found without selectedFields ✓
- importVooFromFlightAwareCache contains `'atualizado'` (not `'actualizado'`) ✓
- VooFlightAwareReviewModal contains "Atualizar Existente" button text ✓
- VooFlightAwareReviewModal contains "Criar Novo" button text ✓
- VooFlightAwareReviewModal imports AlertTriangle from lucide-react ✓
- VooFlightAwareReviewModal hides "Confirmar Importacao" when voo_duplicado present ✓
- VooFlightAwareMergeModal exists as new file ✓
- VooFlightAwareMergeModal contains selectedFields state ✓
- VooFlightAwareMergeModal contains type="checkbox" ✓
- VooFlightAwareMergeModal contains mergeableFields computed from existingVoo and faData ✓
- VooFlightAwareMergeModal contains "Selecionar todos disponiveis" ✓
- CacheVooFlightAwareList imports VooFlightAwareMergeModal ✓
- CacheVooFlightAwareList imports importVooFromFlightAwareCache ✓
- CacheVooFlightAwareList contains showMergeModal state ✓
- CacheVooFlightAwareList contains mergeData state ✓
- CacheVooFlightAwareList contains handleDuplicateAction function ✓
- CacheVooFlightAwareList contains handleMergeComplete function ✓
- CacheVooFlightAwareList passes onDuplicateAction to VooFlightAwareReviewModal ✓
- CacheVooFlightAwareList renders VooFlightAwareMergeModal conditionally ✓
- CacheVooFlightAwareList uses forceCreate: true for 'create' action ✓

## Self-Check: PASSED

- src/components/operacoes/VooFlightAwareReviewModal.jsx: FOUND
- src/components/operacoes/VooFlightAwareMergeModal.jsx: FOUND
- src/components/operacoes/CacheVooFlightAwareList.jsx: FOUND
- src/functions/importVooFromFlightAwareCache.js: FOUND
- .planning/phases/02-flightaware-ui/02-02-SUMMARY.md: FOUND
- Commit 7313db0 (Task 1): FOUND
- Commit 04a2609 (Task 2): FOUND
