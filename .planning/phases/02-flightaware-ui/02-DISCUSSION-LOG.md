# Phase 2: FlightAware UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 02-flightaware-ui
**Areas discussed:** Badge design & placement, Real flights filter, Duplicate detection UX, FA data merge flow

---

## Badge Design & Placement

### Q1: How should the 'Dados FlightAware' badge look?

| Option | Description | Selected |
|--------|-------------|----------|
| Blue info badge | Blue tint (border-blue-400 text-blue-700 bg-blue-50) — visually distinct from amber warning badges | ✓ |
| Match amber style | Same amber outline as the other FA badges — keeps all FlightAware indicators grouped | |
| Subtle gray tag | Gray muted style (text-slate-500 bg-slate-100) — always visible but non-distracting | |

**User's choice:** Blue info badge
**Notes:** Distinct from amber warnings to separate "origin info" from "action needed" semantics.

### Q2: Where should the 'Dados FlightAware' badge appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Next to flight number | Badge beside numero_voo cell — first thing user sees | |
| New 'Fonte' column | Add a small 'Fonte' column — filterable/sortable | |
| You decide | Claude picks best placement | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion — will evaluate table layout and space.

### Q3: Can all 3 badges stack simultaneously?

| Option | Description | Selected |
|--------|-------------|----------|
| All can stack | Row could show all 3 badges at once — maximum information | ✓ |
| FA badge hides if warnings | 'Dados FlightAware' only shows when no verification warnings | |

**User's choice:** All can stack
**Notes:** None.

---

## Real Flights Filter

### Q1: How should the 'real flights only' filter be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle switch | Simple on/off toggle labeled 'Apenas voos reais' — quick, binary, always visible | ✓ |
| Dropdown option | Add 'Voos Reais' to existing status filter dropdown — keeps filter area compact | |
| Checkbox | Checkbox 'Ocultar cancelados / sem dados reais' — familiar pattern, stackable | |

**User's choice:** Toggle switch
**Notes:** None.

### Q2: Default state of the toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| OFF by default | Show all cached flights initially — user opts in to filtering | ✓ |
| ON by default | Show only real flights by default — cleaner initial view | |

**User's choice:** OFF by default
**Notes:** Avoids confusion about "missing" flights.

---

## Duplicate Detection UX

### Q1: How should the duplicate warning appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline warning banner | Yellow/amber alert inside import modal with existing flight details | |
| Confirmation dialog | Separate dialog with side-by-side comparison | |
| You decide | Claude picks based on existing modal patterns | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion.

### Q2: What options should the user have when duplicate detected?

| Option | Description | Selected |
|--------|-------------|----------|
| Update + Create + Cancel | 3 buttons: 'Atualizar Existente', 'Criar Novo', 'Cancelar' — maximum flexibility | ✓ |
| Update + Cancel only | 2 buttons only — prevents accidental duplicates | |
| You decide | Claude picks based on backend merge logic | |

**User's choice:** Update + Create + Cancel
**Notes:** None.

---

## FA Data Merge Flow

### Q1: Should user see which fields will be updated before confirming?

| Option | Description | Selected |
|--------|-------------|----------|
| Show field comparison | Side-by-side table: current vs FA values, highlighting fields to fill | ✓ |
| Summary only | Brief summary like 'FlightAware preenchera 3 campos vazios' | |
| No preview, just merge | Merge immediately — fastest flow | |

**User's choice:** Show field comparison
**Notes:** Full transparency before merge.

### Q2: Cherry-pick fields or all-or-nothing?

| Option | Description | Selected |
|--------|-------------|----------|
| Cherry-pick fields | Checkboxes next to each field — user selects which FA values to apply | ✓ |
| All-or-nothing | Either merge all empty fields or cancel | |

**User's choice:** Cherry-pick fields
**Notes:** None.

### Q3: Post-merge cache status?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mark importado | Consistent behavior — same status for create and merge | |
| New status 'atualizado' | Distinct status to track merges separately from new imports | ✓ |

**User's choice:** New status 'atualizado'
**Notes:** Granular tracking of what happened to each cache entry.

---

## Claude's Discretion

- Badge placement for "Dados FlightAware" on VoosTable rows
- Duplicate warning presentation style (inline banner vs dialog)

## Deferred Ideas

None — discussion stayed within phase scope.
