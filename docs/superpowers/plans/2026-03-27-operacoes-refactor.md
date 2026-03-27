# Operacoes.jsx Refactor — Extract Tab Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break Operacoes.jsx from 3008 lines into 4 focused files (~800 lines each max) by extracting 3 tab components.

**Architecture:** Props-down pattern. Operacoes.jsx keeps all state, hooks, and handlers. Each extracted tab receives data + callbacks as props and renders its own JSX + local useMemo computations. No new dependencies.

**Tech Stack:** React 18, Vite 6, TanStack Query, Radix UI Tabs

---

## File Structure

| File | Responsibility | Lines (est.) |
|------|---------------|-------------|
| `src/pages/Operacoes.jsx` | Orchestrator: state, hooks, handlers, tab layout, modals | ~900 |
| `src/components/operacoes/VoosTab.jsx` | Tab 1: filters panel (12 fields), action buttons, VoosTable | ~350 |
| `src/components/operacoes/VoosLigadosTab.jsx` | Tab 2: header badges, VoosLigadosFilters, VoosLigadosTable, action buttons | ~250 |
| `src/components/operacoes/VoosSemLinkTab.jsx` | Tab 3: stats cards, filters, unlinked flights table with suggestions popover | ~400 |

### Props Interface (each tab)

**VoosTab props:**
```
voosFiltrados, isLoadingAll, isFiltering, filtros, companhiaOptions,
tipoMovimentoOptions, aeroportos, t, language,
onFilterChange, onSort, onBuscar, onClearFilters, onRefresh, onExportCSV,
onOpenForm, onLixeira, sortField, sortDirection,
onEditVoo, onCancelarVoo, onExcluirVoo, onLinkarManual, onUploadDocumento,
onVerDocumentosVoo, onRecursosVoo, isSuperAdmin, isAdminProfile
```

**VoosLigadosTab props:**
```
voosLigadosValidos, voosLigadosFiltrados, voos, calculosTarifa, aeroportos,
companhias, isLoadingAll, isFilteringLigados, filtrosLigados, t, language,
formatCurrency, configuracaoSistema,
onFilterChange, onBuscar, onSort, sortFieldLigados, sortDirectionLigados,
onExcluirVooLigado, onRecalcularTarifasLote, onShowTariffDetails,
onExportTariffPDF, onExportCSV, onGerarProforma, onAlterarCambio,
onUploadDocumento, onVerDocumentosVoo, onRecursosVoo, onUploadMultiplos
```

**VoosSemLinkTab props:**
```
voosSemLink, voosSemLinkComputed, semLinkStats, isLoadingSemLink,
isLinkingAuto, filtrosSemLink, semLinkLoaded, aeroportos, companhias, t,
onLinkarAutomatico, onLinkarManual, onLoadSemLink, onFilterChange,
getSugestoesPar
```

---

### Task 1: Extract VoosTab.jsx

**Files:**
- Create: `src/components/operacoes/VoosTab.jsx`
- Modify: `src/pages/Operacoes.jsx` (remove JSX lines 2132-2351, add VoosTab import + usage)

- [ ] **Step 1: Create VoosTab.jsx shell**

Create `src/components/operacoes/VoosTab.jsx` with:
- Copy the entire `<TabsContent value="voos">` JSX block (lines 2132-2351) from Operacoes.jsx
- Wrap in `export default function VoosTab({ ...props })`
- Copy the local imports needed (Card, Button, Input, Label, Select, Combobox, Badge, icons)
- Copy the `voosFiltrados` useMemo (line 1838), `companhiaOptions` useMemo (line 2024), `tipoMovimentoOptions` useMemo (line 2043) into the component
- Move filter-related constants (tipoVooOptions, statusOptions, etc.) that are only used in this tab
- All handler calls become `props.onXxx()`

- [ ] **Step 2: Wire VoosTab into Operacoes.jsx**

In Operacoes.jsx:
- Add import: `import VoosTab from '../components/operacoes/VoosTab';`
- Replace the entire `<TabsContent value="voos">...</TabsContent>` block (lines 2132-2351) with:
```jsx
<TabsContent value="voos" className="space-y-4 sm:space-y-6">
  <VoosTab
    voos={voos}
    voosLigados={voosLigados}
    calculosTarifa={calculosTarifa}
    isLoadingAll={isLoadingAll}
    isFiltering={isFiltering}
    filtros={filtros}
    aeroportos={aeroportos}
    companhias={companhias}
    sortField={sortField}
    sortDirection={sortDirection}
    t={t}
    language={language}
    currentUser={currentUser}
    onFilterChange={handleFilterChange}
    onSort={handleSort}
    onBuscar={handleBuscarVoos}
    onClearFilters={clearFilters}
    onRefresh={loadData}
    onExportCSV={handleExportCSV}
    onOpenForm={handleOpenForm}
    onLixeira={() => setIsLixeiraModalOpen(true)}
    onEditVoo={(voo) => handleOpenForm(voo)}
    onCancelarVoo={handleCancelarVoo}
    onExcluirVoo={handleExcluirVoo}
    onLinkarManual={handleLinkarManual}
    onUploadDocumento={handleUploadDocumento}
    onVerDocumentosVoo={handleVerDocumentosVoo}
    onRecursosVoo={handleRecursosVoo}
  />
</TabsContent>
```
- Remove the `voosFiltrados`, `companhiaOptions`, `tipoMovimentoOptions` useMemos from Operacoes.jsx (moved to VoosTab)

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/operacoes/VoosTab.jsx src/pages/Operacoes.jsx
git commit -m "refactor(operacoes): extract VoosTab component (~220 lines JSX + 3 useMemos)"
```

---

### Task 2: Extract VoosLigadosTab.jsx

**Files:**
- Create: `src/components/operacoes/VoosLigadosTab.jsx`
- Modify: `src/pages/Operacoes.jsx` (remove JSX lines 2354-2458, add import + usage)

- [ ] **Step 1: Create VoosLigadosTab.jsx shell**

Create `src/components/operacoes/VoosLigadosTab.jsx` with:
- Copy the entire `<TabsContent value="linkados">` JSX block (lines 2354-2458)
- Wrap in `export default function VoosLigadosTab({ ...props })`
- Copy local imports (Card, Button, Badge, icons, VoosLigadosTable, VoosLigadosFilters)
- Move the `voosLigadosFiltrados` useMemo (line 1906) into this component
- All handler calls become `props.onXxx()`

- [ ] **Step 2: Wire VoosLigadosTab into Operacoes.jsx**

In Operacoes.jsx:
- Add import: `import VoosLigadosTab from '../components/operacoes/VoosLigadosTab';`
- Replace the `<TabsContent value="linkados">...</TabsContent>` block with:
```jsx
<TabsContent value="linkados" className="space-y-4 sm:space-y-6">
  <VoosLigadosTab
    voosLigadosValidos={voosLigadosValidos}
    voos={voos}
    calculosTarifa={calculosTarifa}
    aeroportos={aeroportos}
    companhias={companhias}
    isLoadingAll={isLoadingAll}
    isFilteringLigados={isFilteringLigados}
    filtrosLigados={filtrosLigados}
    sortFieldLigados={sortFieldLigados}
    sortDirectionLigados={sortDirectionLigados}
    configuracaoSistema={configuracaoSistema}
    t={t}
    language={language}
    formatCurrency={formatCurrency}
    onFilterChange={(field, value) => setFiltrosLigados(prev => ({ ...prev, [field]: value }))}
    onBuscar={handleBuscarLigados}
    onSort={(field, dir) => { setSortFieldLigados(field); setSortDirectionLigados(dir); }}
    onExcluirVooLigado={handleExcluirVooLigado}
    onRecalcularTarifasLote={handleRecalcularTarifasLote}
    onShowTariffDetails={handleShowTariffDetails}
    onExportTariffPDF={handleExportTariffPDF}
    onExportCSV={handleExportLinkedFlightsCSV}
    onGerarProforma={handleGerarProforma}
    onAlterarCambio={handleAlterarCambio}
    onUploadDocumento={handleUploadDocumento}
    onVerDocumentosVoo={handleVerDocumentosVoo}
    onRecursosVoo={handleRecursosVoo}
    onUploadMultiplos={(vl) => { setUploadMultiplosModalData(vl); setIsUploadMultiplosModalOpen(true); }}
  />
</TabsContent>
```
- Remove `voosLigadosFiltrados` useMemo from Operacoes.jsx (moved to VoosLigadosTab)

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/operacoes/VoosLigadosTab.jsx src/pages/Operacoes.jsx
git commit -m "refactor(operacoes): extract VoosLigadosTab component (~105 lines JSX + 1 useMemo)"
```

---

### Task 3: Extract VoosSemLinkTab.jsx

**Files:**
- Create: `src/components/operacoes/VoosSemLinkTab.jsx`
- Modify: `src/pages/Operacoes.jsx` (remove JSX lines 2460-2761, add import + usage)

- [ ] **Step 1: Create VoosSemLinkTab.jsx shell**

Create `src/components/operacoes/VoosSemLinkTab.jsx` with:
- Copy the entire `<TabsContent value="sem_link">` JSX block (lines 2460-2761)
- Wrap in `export default function VoosSemLinkTab({ ...props })`
- Copy local imports (Card, Button, Badge, Input, Label, Select, Combobox, Table, Popover, icons)
- Copy `format`, `parseISO` imports from date-fns
- All handler calls become `props.onXxx()`
- The inline `getSugestoesPar(voo)` calls become `props.getSugestoesPar(voo)`

- [ ] **Step 2: Wire VoosSemLinkTab into Operacoes.jsx**

In Operacoes.jsx:
- Add import: `import VoosSemLinkTab from '../components/operacoes/VoosSemLinkTab';`
- Replace the `<TabsContent value="sem_link">...</TabsContent>` block with:
```jsx
<TabsContent value="sem_link" className="space-y-4 sm:space-y-6">
  <VoosSemLinkTab
    voosSemLink={voosSemLink}
    voosSemLinkComputed={voosSemLinkComputed}
    semLinkStats={semLinkStats}
    isLoadingSemLink={isLoadingSemLink}
    isLinkingAuto={isLinkingAuto}
    filtrosSemLink={filtrosSemLink}
    semLinkLoaded={semLinkLoaded}
    aeroportos={aeroportos}
    companhias={companhias}
    t={t}
    onLinkarAutomatico={handleLinkarAutomatico}
    onLinkarManual={handleLinkarManual}
    onLoadSemLink={loadVoosSemLink}
    onFilterChange={(field, value) => setFiltrosSemLink(prev => ({ ...prev, [field]: value }))}
    getSugestoesPar={getSugestoesPar}
  />
</TabsContent>
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/operacoes/VoosSemLinkTab.jsx src/pages/Operacoes.jsx
git commit -m "refactor(operacoes): extract VoosSemLinkTab component (~302 lines JSX)"
```

---

### Task 4: Cleanup Operacoes.jsx

**Files:**
- Modify: `src/pages/Operacoes.jsx`

- [ ] **Step 1: Remove unused imports**

After extraction, Operacoes.jsx no longer directly uses these in its JSX:
- Remove: `Input`, `Label`, `Select`, `Combobox` (only used inside extracted tabs)
- Remove: `Filter`, `Search`, `ArrowRightLeft`, `Unlink` icons (only used inside extracted tabs)
- Remove: `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` (only used in VoosSemLinkTab)
- Remove: `Popover, PopoverContent, PopoverTrigger` (only used in VoosSemLinkTab)
- Remove: `format, parseISO, addDays` from date-fns (only used in VoosSemLinkTab)
- Keep: VoosLigadosTable, VoosLigadosFilters imports are now in VoosLigadosTab — remove from Operacoes.jsx

- [ ] **Step 2: Verify final line count and build**

Run: `wc -l src/pages/Operacoes.jsx` — should be ~900 lines
Run: `npx vite build` — should succeed

- [ ] **Step 3: Final commit**

```bash
git add src/pages/Operacoes.jsx
git commit -m "refactor(operacoes): cleanup unused imports after tab extraction (3008→~900 lines)"
```

---

## Verification Checklist

After all tasks:
- [ ] `npx vite build` passes
- [ ] `wc -l src/pages/Operacoes.jsx` is ~900 lines
- [ ] All 5 tabs work in browser (voos, linkados, sem_link, fids, configuracoes)
- [ ] Create flight → appears in list without F5
- [ ] Filter flights → server-side search works
- [ ] Linked flights tab → recalculate tariff works
- [ ] Sem link tab → auto-link works
- [ ] Export CSV works from both voos and linkados tabs

## Risk Mitigations

1. **Inline handlers in JSX:** Some tabs have inline `onClick={() => { setState(...) }}`. These must be converted to named prop callbacks.
2. **Shared state mutations:** All `queryClient.invalidateQueries` calls stay in Operacoes.jsx handlers — tabs only call `props.onXxx()`.
3. **Build after each task:** Never proceed to next task if build fails.
