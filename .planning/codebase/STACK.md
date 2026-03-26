# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- JavaScript (ES2022+, ESM modules) - All frontend code (`src/**/*.{js,jsx}`)
- TypeScript (Deno) - Supabase Edge Functions (`supabase/functions/*/index.ts`)

**Secondary:**
- SQL - Database migrations (`supabase/migrations/*.sql`)
- CSS - Tailwind utility classes + custom CSS (`src/index.css`)

## Runtime

**Environment:**
- Node.js v22+ (local dev, detected v22.17.1)
- Deno (Supabase Edge Functions runtime, uses `https://deno.land/std` imports)
- Browser (SPA target, PWA-capable)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React ^18.2.0 - UI framework (`src/`)
- React Router DOM ^6.26.0 - Client-side routing (`src/App.jsx`)
- TanStack React Query ^5.84.1 - Server state management (`src/lib/query-client.js`)

**UI:**
- Tailwind CSS ^3.4.17 - Utility-first styling (`tailwind.config.js`)
- Radix UI - Headless component primitives (20+ packages: dialog, select, popover, tabs, etc.)
- shadcn/ui pattern - Component library built on Radix + Tailwind (`src/components/ui/`)
- Framer Motion ^11.16.4 - Animations
- Lucide React ^0.475.0 - Icons

**Testing:**
- Vitest ^4.1.0 - Test runner (config in `vite.config.js`)
- Testing Library React ^16.3.2 - Component testing
- Testing Library Jest DOM ^6.9.1 - DOM assertions
- jsdom ^29.0.0 - Browser environment for tests

**Build/Dev:**
- Vite ^6.1.0 - Build tool and dev server (`vite.config.js`)
- @vitejs/plugin-react ^4.3.4 - React Fast Refresh
- vite-plugin-pwa ^1.2.0 - Progressive Web App support
- PostCSS ^8.5.3 + Autoprefixer ^10.4.20 - CSS processing
- ESLint ^9.19.0 - Linting (`eslint.config.js`)

## Key Dependencies

**Critical:**
- @supabase/supabase-js ^2.98.0 - Database, auth, storage, edge functions client (`src/lib/supabaseClient.js`)
- @tanstack/react-query ^5.84.1 - Data fetching/caching with offline-first mode (`src/lib/query-client.js`)
- react-router-dom ^6.26.0 - All navigation and route guards
- zod ^3.24.2 - Schema validation (used with react-hook-form)
- react-hook-form ^7.54.2 + @hookform/resolvers ^4.1.2 - Form management

**Data/Export:**
- jspdf ^4.2.0 - PDF generation (`src/lib/pdfTemplate.js`)
- pdf-lib ^1.17.1 - PDF manipulation
- xlsx ^0.18.5 - Excel import/export
- html2canvas ^1.4.1 - Screenshot/PDF capture
- recharts ^2.15.4 - Data visualization charts

**Security:**
- dompurify ^3.3.2 - HTML sanitization (`src/lib/sanitize.js`)

**Monitoring:**
- @sentry/react ^10.43.0 - Error tracking (`src/main.jsx`)
- web-vitals ^5.1.0 - Performance metrics to `performance_log` table (`src/lib/webVitals.js`)

**UI Extras:**
- react-quill ^2.0.0 - Rich text editor
- react-day-picker ^8.10.1 - Date picker
- cmdk ^1.0.0 - Command palette
- @hello-pangea/dnd ^17.0.0 - Drag and drop
- embla-carousel-react ^8.5.2 - Carousel
- react-resizable-panels ^2.1.7 - Resizable layouts
- sonner ^2.0.1 + react-hot-toast ^2.6.0 - Toast notifications
- vaul ^1.1.2 - Drawer component
- react-markdown ^9.0.1 - Markdown rendering
- canvas-confetti ^1.9.4 - Confetti effects

**Payments (installed but limited use):**
- @stripe/stripe-js ^5.2.0 + @stripe/react-stripe-js ^3.0.0

**Utilities:**
- date-fns ^3.6.0 - Date manipulation
- clsx ^2.1.1 + tailwind-merge ^3.0.2 - Class name utilities
- class-variance-authority ^0.7.1 - Variant-based component styling
- input-otp ^1.4.2 - OTP input component
- next-themes ^0.4.4 - Dark mode theming

## Configuration

**Environment:**
- `.env` file present - contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_GOOGLE_CLIENT_ID`
- `.env.example` present - documents required vars
- All client-side env vars use `VITE_` prefix (Vite convention)
- Edge Functions use Deno.env for server-side secrets (SMTP, API keys)

**Build:**
- `vite.config.js` - Build config with manual chunks (vendor splitting), PWA manifest, path alias `@` -> `src/`
- `tailwind.config.js` - shadcn/ui theme with CSS custom properties, dark mode via `class` strategy
- `postcss.config.js` - Tailwind + Autoprefixer
- `eslint.config.js` - Flat config with react, react-hooks, react-refresh, unused-imports plugins
- `jsconfig.json` - Path aliases for IDE support

**PWA Configuration:**
- Service worker with Workbox (`vite-plugin-pwa`)
- Supabase REST API: `NetworkOnly` (avoids stale data on slow Angola connections)
- Supabase Storage: `CacheFirst` with 24h expiration, 100 entry limit
- Auto-update registration, standalone display mode

**Build Output (manual chunks):**
- `vendor-react` - React, ReactDOM, React Router
- `vendor-ui` - Radix UI components
- `vendor-charts` - Recharts
- `vendor-pdf` - jsPDF
- `vendor-query` - TanStack Query
- `vendor-supabase` - Supabase client
- `vendor-dates` - date-fns
- `vendor-xlsx` - XLSX
- `vendor-motion` - Framer Motion

## Platform Requirements

**Development:**
- Node.js 22+
- npm
- Supabase CLI (for edge function development/deployment)

**Production:**
- Static SPA hosted on Hostinger (via SSH deploy)
- Supabase cloud (Sao Paulo region) for backend services
- Cloudflare (CDN/proxy - referenced in `cloudflare-metrics` edge function)

## Scripts

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint (quiet mode)
npm run lint:fix     # ESLint auto-fix
npm run test         # Vitest run (single pass)
npm run test:watch   # Vitest watch mode
```

---

*Stack analysis: 2026-03-26*
