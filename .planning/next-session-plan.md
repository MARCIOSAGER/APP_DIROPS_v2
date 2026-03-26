# Next Session Plan — Operacoes.jsx Refactor

## Goal
Break 3008-line Operacoes.jsx into manageable sub-components (Approach A — safe extraction).

## Components to Extract

### 1. VoosTab.jsx (~600 lines)
- Filters panel (12 filter fields)
- VoosTable integration
- Action buttons (Refresh, Export, Lixeira, Add)
- Props: filtros, handlers, voos, companhias, aeroportos, etc.

### 2. VoosLigadosTab.jsx (~400 lines)
- VoosLigadosFilters + VoosLigadosTable
- Recalcular tarifa inline handler
- Props: filtrosLigados, voosLigados, calculosTarifa, handlers

### 3. VoosSemLinkTab.jsx (~300 lines)
- Unlinked flights list
- Auto-linking logic
- Props: voosSemLink, handlers

## Operacoes.jsx After (~800 lines)
- State declarations (42 variables)
- All handlers (31 functions)
- TanStack Query hooks
- Tab layout with 5 TabsContent
- Modal renders (already lazy-loaded)

## Key Risks
- Inline handlers in JSX (need to extract to named functions)
- State shared between tabs (voos used in both Voos and Ligados)
- onRecalcularTarifa inline async in Ligados tab JSX

## Pre-flight Checks
- [ ] Verify all handler references before moving JSX
- [ ] Test each tab after extraction
- [ ] Run full build after each component
