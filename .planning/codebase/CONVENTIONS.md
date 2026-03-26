# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- Pages: `PascalCase.jsx` (e.g., `src/pages/Operacoes.jsx`, `src/pages/GestaoEmpresas.jsx`)
- Components: `PascalCase.jsx` (e.g., `src/components/operacoes/FormVoo.jsx`, `src/components/shared/AlertModal.jsx`)
- UI primitives: `kebab-case.jsx` (e.g., `src/components/ui/button.jsx`, `src/components/ui/alert-dialog.jsx`)
- Entities: `PascalCase.js` (e.g., `src/entities/Voo.js`, `src/entities/CalculoTarifa.js`)
- Hooks: `camelCase.js` with `use` prefix (e.g., `src/hooks/useVoos.js`, `src/hooks/useSubmitGuard.js`)
- Utility modules: `camelCase.js` (e.g., `src/lib/errorUtils.js`, `src/lib/sanitize.js`)
- Test files: `{module}.test.js` inside `__tests__/` sibling directory

**Functions:**
- Use `camelCase` for all functions: `showErrorToast`, `filtrarDadosPorAcesso`, `calculateTarifaPouso`
- React components use `PascalCase`: `AlertModal`, `FormVoo`, `VoosTable`
- Hooks use `use` prefix: `useVoos`, `useSubmitGuard`, `useCalculosTarifa`
- Event handlers: `handle` prefix in JSX (e.g., `handleSave`, `handleDelete`)
- Boolean helpers: `is`/`has` prefix (e.g., `isSuperAdmin`, `hasPageAccess`, `hasUserProfile`)

**Variables:**
- Use `camelCase` for local variables and state
- Use `UPPER_SNAKE_CASE` for constants: `PAGE_SIZE`, `ALERT_TYPES`, `PDF`
- State: `[value, setValue]` pattern with descriptive names

**Types:**
- No TypeScript types in source code (JavaScript-only codebase with `jsconfig.json`)
- Zod schemas used for form validation via `@hookform/resolvers`

## Code Style

**Formatting:**
- No Prettier config at project root; default formatting applies
- Single quotes for strings in JS (observed pattern)
- 2-space indentation
- Semicolons used

**Linting:**
- ESLint 9 (flat config) at `eslint.config.js`
- Plugins: `react`, `react-hooks`, `unused-imports`
- Key rules:
  - `unused-imports/no-unused-imports`: warn (auto-removable)
  - `unused-imports/no-unused-vars`: warn (ignore `_` prefixed)
  - `react/prop-types`: off (no PropTypes required)
  - `react/react-in-jsx-scope`: off (React 18 auto-import)
  - `react-hooks/rules-of-hooks`: error
  - `no-unused-vars`: off (delegated to unused-imports plugin)
- Ignored paths: `src/components/ui/**/*`, `src/lib/**/*` (shadcn/ui generated code)
- Run lint: `npm run lint` or `npm run lint:fix`

## Import Organization

**Order:**
1. React and React hooks (`import React, { useState, useEffect, ... }`)
2. Third-party libraries (`@tanstack/react-query`, `date-fns`, `lucide-react`)
3. UI components (`@/components/ui/button`, `@/components/ui/card`)
4. Internal modules (`@/lib/...`, `@/entities/...`, `@/hooks/...`)
5. Relative imports for sibling components (`../components/operacoes/FormVoo`)

**Path Aliases:**
- `@/` maps to `src/` (configured in `vite.config.js` and `jsconfig.json`)
- Use `@/` for all imports from `src/` directory
- Use relative paths only for sibling/child component imports within the same feature

**Example:**
```jsx
// src/pages/Operacoes.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/components/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabaseClient';
import { Voo } from '@/entities/Voo';
import { useAuth } from '@/lib/AuthContext';
import { useVoos } from '@/hooks/useVoos';

import VoosTable from '../components/operacoes/VoosTable';
import FormVoo from '../components/operacoes/FormVoo';
```

## Component Patterns

**Page Components:**
- Exported as default from `src/pages/PascalCase.jsx`
- Use `useAuth()` for current user, `useCompanyView()` for multi-tenant context
- Use `useI18n()` for translated strings via `t('key')`
- Heavy use of shadcn/ui primitives (`Card`, `Tabs`, `Dialog`, `Table`, etc.)
- State managed with `useState`/`useCallback`/`useMemo` (no Redux/Zustand)

**Shared Components:**
- Located in `src/components/shared/` for cross-feature reuse
- Examples: `AlertModal`, `SuccessModal`, `ConfirmModal`, `CancelarProformaModal`
- Accept props like `isOpen`, `onClose`, `type`, `title`, `message`

**UI Components (shadcn/ui):**
- Located in `src/components/ui/` -- auto-generated, do NOT modify directly
- Use `cn()` utility from `@/lib/utils` for conditional class merging
- Use `cva()` (class-variance-authority) for component variants
- All use `React.forwardRef` pattern with `displayName`

**Feature Components:**
- Organized by domain: `src/components/operacoes/`, `src/components/faturacao/`, etc.
- Each feature directory contains related sub-components
- Large forms are standalone files (e.g., `FormVoo.jsx`)

**Entity Pattern:**
- All entities in `src/entities/PascalCase.js` are thin wrappers:
```js
import { createEntity } from './_createEntity';
export const Voo = createEntity('voo');
```
- `_createEntity.js` provides: `.list()`, `.filter()`, `.create()`, `.update()`, `.delete()`
- Table name auto-converts CamelCase to snake_case
- 500-row pagination built into all queries

**Data Fetching:**
- TanStack Query (`@tanstack/react-query`) for server state
- Custom hooks wrap entity calls: `useVoos`, `useCalculosTarifa`
- Query keys follow `['resource', ...params]` pattern
- Static data hooks in `src/components/lib/useStaticData.js`
- Default staleTime: 2 minutes, gcTime: 10 minutes (configured in `src/lib/query-client.js`)

**Hook Pattern:**
```js
// src/hooks/useVoos.js
import { useQuery } from '@tanstack/react-query';
import { Voo } from '@/entities/Voo';

export function useVoos({ empresaId, enabled = true } = {}) {
  return useQuery({
    queryKey: ['voos', empresaId],
    queryFn: () => {
      const filters = { deleted_at: { $is: null } };
      if (empresaId) filters.empresa_id = empresaId;
      return Voo.filter(filters, '-data_operacao', 1000);
    },
    enabled: !!empresaId && enabled,
  });
}
```

## Styling Approach

**Framework:** Tailwind CSS 3 with shadcn/ui design system

**Theme:**
- CSS custom properties for colors (HSL-based) configured in `tailwind.config.js`
- Dark mode supported via `class` strategy (`darkMode: ["class"]`)
- Semantic color tokens: `primary`, `secondary`, `destructive`, `muted`, `accent`, `background`, `foreground`
- Custom border radius via `--radius` CSS variable

**Patterns:**
- Use Tailwind utility classes directly in JSX
- Use `cn()` from `@/lib/utils` for conditional/merged classes:
```jsx
<div className={cn("p-4 rounded-lg", isActive && "bg-primary text-primary-foreground")} />
```
- Dark mode variants: always include `dark:` variants (e.g., `bg-green-50 dark:bg-green-950`)
- Icons from `lucide-react` (e.g., `Plus`, `RefreshCw`, `Trash2`, `Loader2`)

**Button Colors Standard:**
- Primary actions: `bg-blue-600 hover:bg-blue-700` (blue)
- Destructive/delete: `variant="destructive"` (red)
- Secondary/cancel: `variant="outline"` or `variant="ghost"`
- Success: `bg-green-600 hover:bg-green-700`

## Error Handling

**Patterns:**
- Use `showErrorToast(message, error)` from `src/lib/errorUtils.js` for user-facing errors
- Use `showSuccessToast(message)` for success feedback
- Use `getErrorMessage(error)` to extract message from various error shapes (string, Error, {message}, {error_description})
- Entity operations throw contextual errors: `"Erro ao criar voo: duplicate key"`
- Try/catch in all async handlers with toast notification

**Example:**
```jsx
try {
  await Voo.create(data);
  showSuccessToast('Voo criado com sucesso!');
} catch (err) {
  showErrorToast(getErrorMessage(err), err);
}
```

**Submit Guard:**
- Use `useSubmitGuard()` hook to prevent double-submit:
```jsx
const { isSubmitting, guardedSubmit } = useSubmitGuard();
const handleSave = () => guardedSubmit(async () => { /* ... */ });
```

## i18n / Internationalization

**Framework:** Custom context-based i18n system in `src/components/lib/i18n.jsx`

**Languages:** Portuguese (pt) and English (en) -- single file (~11,895 lines)

**Provider:** `<I18nProvider>` wraps app, stores language in `localStorage`

**Usage:**
```jsx
import { useI18n } from '@/components/lib/i18n';

function MyComponent() {
  const { t, language, setLanguage } = useI18n();
  return <h1>{t('page.operacoes.title')}</h1>;
}
```

**Key Namespaces:**
- `layout.*` -- Layout chrome, navigation, auth messages
- `nav.*` -- Navigation menu items
- `page.{module}.*` -- Page titles and subtitles
- `btn.*` -- Common button labels (save, cancel, delete, etc.)
- `label.*` -- Common form labels (name, email, status, etc.)
- `tab.*` -- Tab names
- `operacoes.*`, `auditoria.*`, `safety.*`, etc. -- Feature-specific strings
- `msg.*` -- Common messages (success, error, confirmation)

**Fallback:** Returns the key itself if translation not found: `translations[language]?.[key] || key`

**Rules for new strings:**
- Always add both `pt` and `en` translations
- Use dot-notation keys: `'module.section.label'`
- Portuguese is the primary language (app users are primarily Angolan)

## State Management

**Local State:** `useState` for component-level state (no global state library)

**Server State:** TanStack Query for all Supabase data

**Auth State:** React Context via `src/lib/AuthContext.jsx`
- Provides: `user`, `isAuthenticated`, `isLoadingAuth`, `login`, `logout`
- Auto-creates user profile on first login

**Company View:** React Context via `src/lib/CompanyViewContext.jsx`
- Superadmin can "view as" a specific empresa
- Provides `effectiveEmpresaId` for multi-tenant filtering

**Multi-tenant Filtering:**
- Use `filtrarDadosPorAcesso(user, data, field, aeroportos)` from `src/components/lib/userUtils.jsx`
- Use `filtrarDadosPorEmpresa(data, field, aeroportos, empresaId)` for empresa-scoped data
- Use `getAeroportosPermitidos(user, aeroportos)` for airport-level access

## Logging

**Framework:** `console.*` (no structured logging library)

**Patterns:**
- `console.error(message, error)` for errors (via `showErrorToast`)
- `console.warn('[MODULE] message')` for warnings with bracketed module prefix
- Production: Sentry SDK (`@sentry/react`) for error tracking
- Audit logging: `src/components/lib/auditoria.js` for user action tracking to `log_auditoria` table

## Comments

**When to Comment:**
- Section separators in test files: `// -- sectionName --` with em-dashes
- Explain "why" for non-obvious decisions (e.g., `// Angola connectivity can be slow; a 5s SW timeout...`)
- Migration references (e.g., `// Auth debug logging removed for security (M-05)`)

**JSDoc/TSDoc:**
- Not used (plain JavaScript codebase)

## Module Design

**Exports:**
- Pages: `export default function PageName()` (default export)
- Components: `export default function ComponentName()` (default export)
- Entities: named exports (`export const Voo = createEntity('voo')`)
- Hooks: named exports (`export function useVoos()`)
- Utilities: named exports (`export function showErrorToast()`)
- UI components: named exports (`export { Button, buttonVariants }`)

**Barrel Files:**
- Not used; each module imports directly from its source file

---

*Convention analysis: 2026-03-26*
