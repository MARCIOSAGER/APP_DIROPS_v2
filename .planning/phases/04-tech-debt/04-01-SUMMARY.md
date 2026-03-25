---
phase: 04-tech-debt
plan: 01
subsystem: ui
tags: [react, permissions, role-based-access, refactor]

requires:
  - phase: 01-bug-fixes
    provides: stable base pages used for inline checks
  - phase: 02-flightaware-ui
    provides: completed page set that still had inline role checks

provides:
  - isAdminProfile(user) helper in userUtils.jsx — delegates to hasUserProfile + role check
  - isInfraOrAdmin(user) helper in userUtils.jsx — delegates to hasAnyUserProfile
  - Zero inline perfis.includes('administrador') or role === 'admin' checks in pages

affects: [03-flightaware-automation, 04-tech-debt, 05-i18n]

tech-stack:
  added: []
  patterns: [centralized-role-check, single-point-permission-update]

key-files:
  created: []
  modified:
    - src/components/lib/userUtils.jsx
    - src/pages/GestaoNotificacoes.jsx
    - src/pages/Manutencao.jsx
    - src/pages/Auditoria.jsx
    - src/pages/Operacoes.jsx
    - src/pages/KPIsOperacionais.jsx
    - src/pages/Documentos.jsx
    - src/pages/GerirPermissoes.jsx
    - src/pages/GestaoAcessos.jsx
    - src/pages/LogAuditoria.jsx
    - src/pages/LogAuditoriaDetalhes.jsx
    - src/pages/ConfiguracoesGerais.jsx

key-decisions:
  - "isAdminProfile delegates to hasUserProfile('administrador') — no hardcoded string duplication in logic"
  - "isInfraOrAdmin delegates to hasAnyUserProfile — Manutencao email filter retained with helper (not page logic change)"
  - "GerirPermissoes and GestaoAcessos: role check now includes user.role === 'admin' via isAdminProfile (previously only checked perfis)"

patterns-established:
  - "All admin-gate checks in pages use isAdminProfile(user) — imported from userUtils"
  - "All infra+admin checks use isInfraOrAdmin(user) — avoids array literal duplication"
  - "New perfil in regra_permissao requires zero page edits — only regra_permissao rows need updating"

requirements-completed: [DEBT-01]

duration: 10min
completed: 2026-03-25
---

# Phase 04 Plan 01: Tech Debt (Hardcoded Role Checks) Summary

**Centralized all admin role checks across 11 page files into isAdminProfile/isInfraOrAdmin helpers in userUtils.jsx, eliminating 13 inline perfis.includes/role === 'admin' checks**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-25T14:53:38Z
- **Completed:** 2026-03-25T15:03:46Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added `isAdminProfile(user)` and `isInfraOrAdmin(user)` exports to userUtils.jsx — single point for admin role logic
- Replaced all 13 inline role checks across 11 page files with the new helpers
- Verified zero residual `perfis.includes('administrador')` or `role === 'admin'` access patterns remain in src/pages/

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isAdminProfile helper to userUtils.jsx** - `58a295d` (feat)
2. **Task 2: Replace hardcoded role checks in all page files** - `ea5aea8` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/components/lib/userUtils.jsx` - Added isAdminProfile and isInfraOrAdmin exports
- `src/pages/GestaoNotificacoes.jsx` - !isAdminProfile(user) replaces dual role/perfis check
- `src/pages/Manutencao.jsx` - isInfraOrAdmin in canManage useMemo + email filter
- `src/pages/Auditoria.jsx` - isAdminProfile replaces role+hasUserProfile
- `src/pages/Operacoes.jsx` - isAdminProfile in Lixeira button guard
- `src/pages/KPIsOperacionais.jsx` - isAdminProfile in diagnostico button guard
- `src/pages/Documentos.jsx` - isAdminProfile in canDeleteFolder
- `src/pages/GerirPermissoes.jsx` - isAdminProfile in early return + render guard (2 places)
- `src/pages/GestaoAcessos.jsx` - isAdminProfile in early return + render guard (2 places)
- `src/pages/LogAuditoria.jsx` - isAdminProfile replaces role+hasUserProfile
- `src/pages/LogAuditoriaDetalhes.jsx` - isAdminProfile replaces role+hasUserProfile
- `src/pages/ConfiguracoesGerais.jsx` - !isAdminProfile replaces dual role/perfis check

## Decisions Made

- `isAdminProfile` preserves backward compat: still checks `user.role === 'admin'` in addition to `hasUserProfile(user, 'administrador')` — GerirPermissoes previously only checked perfis, so this is a minor implicit expansion (correct behavior)
- Manutencao's `getManagerEmails` filter (`u.perfis?.some(...)`) was also replaced with `isInfraOrAdmin(u)` — this is an email-recipient filter, not a page gate, but uses the same logic pattern and belongs centralized
- Existing `hasUserProfile` imports retained in files that use it for other checks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 13 locations replaced cleanly. Import additions straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DEBT-01 complete — adding new profile to regra_permissao now requires zero page edits
- Ready for 04-02 (i18n completion or next tech debt item)
- No regressions expected: all replacements preserve identical boolean semantics

## Self-Check: PASSED

- userUtils.jsx: FOUND
- 04-01-SUMMARY.md: FOUND
- Commits 58a295d, ea5aea8: FOUND

---
*Phase: 04-tech-debt*
*Completed: 2026-03-25*
