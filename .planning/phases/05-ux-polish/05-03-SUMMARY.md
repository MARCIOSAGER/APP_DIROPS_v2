---
phase: 05-ux-polish
plan: "03"
subsystem: forms
tags: [ux, forms, radix-ui, consistency]
dependency_graph:
  requires: []
  provides: [consistent-form-selects, consistent-button-colors, consistent-error-styling]
  affects: [FormSafetyOccurrence, FormVoo]
tech_stack:
  added: []
  patterns: [radix-select-over-native-select, text-sm-error-messages, bg-blue-600-primary-buttons]
key_files:
  created: []
  modified:
    - src/components/safety/FormSafetyOccurrence.jsx
    - src/components/operacoes/FormVoo.jsx
    - src/components/lib/i18n.jsx
decisions:
  - "FormSafetyOccurrence gravidade and status selects also replaced (all 3 raw selects removed, not just tipo_ocorrencia)"
  - "Added manual validation for tipo_ocorrencia in handleSubmit to replace removed native required attribute"
  - "FormVoo save button changed from custom green bg-[#169c41] to standard bg-blue-600 per button color standard"
metrics:
  duration: ~180s
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 3
---

# Phase 5 Plan 03: Form Polish — Select Components and Button Consistency Summary

Replaced all raw native `<select>` HTML elements in FormSafetyOccurrence with the app's Radix-based Select component, standardized error message text sizes, and applied the blue primary button color standard to FormVoo — achieving visual consistency across both form modals.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace raw select with Radix Select in FormSafetyOccurrence | 44a7ee3 | FormSafetyOccurrence.jsx, i18n.jsx |
| 2 | Standardize error messages and footer button order in FormVoo | 8dce259 | FormVoo.jsx |

## Changes Made

### Task 1: FormSafetyOccurrence

- Replaced 3 raw `<select>` elements (tipo_ocorrencia, gravidade, status) with Radix `Select` component
- Added `import Select from '@/components/ui/select'`
- Added `errors` state and manual validation for `tipo_ocorrencia` in `handleSubmit` (replaces native `required` which cannot be used on Radix Select)
- Added error display `<p className="text-sm text-red-500">` for tipo_ocorrencia field
- Added i18n keys: `safety.form.tipoObrigatorio` (PT: "Tipo de ocorrência é obrigatório." / EN: "Occurrence type is required.")
- DialogFooter already had correct cancel-left/save-right order
- Form already used `space-y-4`

### Task 2: FormVoo

- Changed `text-xs text-red-500` to `text-sm text-red-500` for the "sem acesso aeroporto" warning message (line 1329)
- Updated save button from `bg-[#169c41] hover:bg-[#128a36]` to `bg-blue-600 hover:bg-blue-700` per button color standard
- DialogFooter already had correct cancel-left/save-right order (verified)
- All `border-t` section separators already use `pt-4` consistently (verified)
- Form wrapper already uses `space-y-4` (verified)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Replaced all 3 raw selects in FormSafetyOccurrence**
- **Found during:** Task 1
- **Issue:** Plan mentioned only replacing tipo_ocorrencia, but gravidade and status also used raw `<select>` elements. Verification criteria said "0 occurrences of `select>`" — all 3 needed replacing.
- **Fix:** Replaced all 3 raw selects with Radix Select component.
- **Files modified:** src/components/safety/FormSafetyOccurrence.jsx
- **Commit:** 44a7ee3

**2. [Rule 2 - Missing Critical Functionality] Added manual tipo_ocorrencia validation**
- **Found during:** Task 1
- **Issue:** Removing `required` from native select eliminated built-in browser validation. handleSubmit had no manual check.
- **Fix:** Added `errors` state, validation in handleSubmit, and error display in JSX.
- **Files modified:** src/components/safety/FormSafetyOccurrence.jsx, src/components/lib/i18n.jsx
- **Commit:** 44a7ee3

## Known Stubs

None — all changes are complete UI consistency fixes with no placeholder data.

## Self-Check: PASSED

- src/components/safety/FormSafetyOccurrence.jsx: FOUND
- src/components/operacoes/FormVoo.jsx: FOUND
- src/components/lib/i18n.jsx: FOUND
- Commit 44a7ee3: FOUND
- Commit 8dce259: FOUND
