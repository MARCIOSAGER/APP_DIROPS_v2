# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**FlightAware AeroAPI:**
- Purpose: Flight data import (arrivals, departures, history)
- Edge Function: `supabase/functions/flightaware-proxy/index.ts`
- Base URL: `https://aeroapi.flightaware.com/aeroapi`
- Auth: `FLIGHTAWARE_API_KEY` env var (Deno.env, server-side only)
- Client-side: invoked via `supabase.functions.invoke('flightaware-proxy', ...)`

**OpenAI / Anthropic (AI Chatbot):**
- Purpose: AI chatbot for user assistance
- Edge Function: `supabase/functions/chatbot-ia/index.ts`
- Rate limited: 20 requests/user/minute (in-memory)
- Message limits: 2000 chars max, 20 messages max per conversation

**Cloudflare:**
- Purpose: CDN/proxy for the app, metrics collection
- Edge Function: `supabase/functions/cloudflare-metrics/index.ts`
- Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` env vars
- Queries Cloudflare GraphQL API for worker invocation metrics (script: `supabase-proxy`)

**Stripe (minimal use):**
- Packages installed: `@stripe/stripe-js`, `@stripe/react-stripe-js`
- Limited usage detected in: `src/pages/KPIsOperacionais.jsx`, `src/lib/pdfTemplate.js`, `src/components/inspecoes/InspecoesList.jsx`
- Not a core payment flow; may be exploratory or for specific KPI features

## Data Storage

**Database:**
- Supabase PostgreSQL (self-hosted cloud, Sao Paulo region)
- Project ref: `glernwcsuwcyzwsnelad`
- Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (client-side)
- Server-side: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions via Deno.env)
- Client: `@supabase/supabase-js` v2 (`src/lib/supabaseClient.js`)
- Entity abstraction: `src/entities/_createEntity.js` (factory pattern, auto CamelCase -> snake_case)
- Pagination: 500-row batches via `fetchAll()` helper
- Filter operators: `$eq`, `$neq/$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$contains`, `$like`, `$cs`, `$cd`, `$overlaps`
- RLS policies enforced; Edge Functions disable gateway JWT and handle auth internally
- 55+ migrations in `supabase/migrations/`

**File Storage:**
- Supabase Storage
- Buckets: `uploads` (public), `private-uploads` (authenticated)
- File upload via `src/api/base44Client.js` -> `integrations.Core.UploadFile()` / `UploadPrivateFile()`
- Max file size: 10MB
- File validation: type checking via `validateFileType()` in `src/lib/sanitize.js`
- Filename sanitization: `sanitizeFilename()` in `src/lib/sanitize.js`
- PWA caching: Storage responses cached with `CacheFirst` strategy (24h, 100 entries)

**Caching:**
- TanStack React Query (client-side)
  - staleTime: 3 minutes
  - gcTime: 15 minutes
  - networkMode: `offlineFirst` (serves cache when offline)
  - refetchOnWindowFocus: disabled
  - refetchOnReconnect: enabled
  - Config: `src/lib/query-client.js`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email/password + Google OAuth)
- Implementation: `src/lib/AuthContext.jsx`
- Flow:
  1. User signs in via Supabase Auth
  2. `AuthContext` loads profile from `users` table (joined via `auth_id`)
  3. Auto-creates profile on first login if none exists (status: `pendente`)
  4. Role derived from `perfis` array (e.g., `administrador` -> `admin`)
- Session: persisted, auto-refresh, URL detection enabled
- Custom lock function: `navigator.locks` fix for compatibility (`src/lib/supabaseClient.js`)
- Global fetch timeout: 15 seconds (AbortSignal.timeout)
- Google OAuth: `VITE_GOOGLE_CLIENT_ID` env var

**User Management:**
- Admin user creation via Edge Function: `supabase/functions/admin-user/index.ts`
- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations (create user, manage profiles)
- Rate limited: 10 requests/IP/minute

**Multi-tenancy:**
- `empresa_id` column on most tables
- `superadmin` role sees all companies
- Access filtering via `filtrarDadosPorAcesso()` in `src/components/lib/userUtils.jsx`

## Email

**SMTP Provider:**
- Hostinger SMTP (smtp.hostinger.com:465)
- Edge Function: `supabase/functions/send-email/index.ts`
- Library: `nodemailer` v6 (npm import in Deno)
- Rate limited: 20 emails/IP/minute
- Auth: JWT required (verified in function, not at gateway)
- SMTP credentials: stored as Supabase Edge Function env vars

**Notification Emails:**
- Edge Function: `supabase/functions/send-notification-email/index.ts`
- Template-based emails
- HTML templates: `src/lib/emailTemplates.js` (centralized, inline CSS for email clients)

## Monitoring & Observability

**Error Tracking:**
- Sentry (`@sentry/react` ^10.43.0)
- Initialized in `src/main.jsx`
- DSN: `VITE_SENTRY_DSN` env var (optional)
- Captures unhandled promise rejections
- React Error Boundary integration in `src/App.jsx`

**Performance Monitoring:**
- Web Vitals (LCP, CLS, FCP, TTFB, INP) logged to `performance_log` Supabase table
- Implementation: `src/lib/webVitals.js`
- Tracks: metric name, value, rating, page path, navigation type, connection type, user ID, empresa_id
- Cloudflare worker metrics via `cloudflare-metrics` Edge Function

**Logs:**
- Console-based logging with `[AUTH]`, `[invokeFunction]` prefixes
- Audit log system: `src/lib/auditLog.js`
- Edge Functions log errors to console (Supabase dashboard)

## External Data API

**Data API (Power BI / External Integrations):**
- Edge Function: `supabase/functions/data-api/index.ts`
- Auth: API key-based (custom `api_key`, `api_access_log`, `api_rate_limit` tables)
- Read-only access to whitelisted entities (20+ tables)
- Column exclusions: strips `created_by`, `updated_by` from responses
- Entities exposed: voo, ordem_servico, inspecao, proforma, aeroporto, calculo_tarifa, etc.

## CI/CD & Deployment

**Hosting:**
- Hostinger VPS (static SPA deployment via SSH)
- Production URL: `https://app.marciosager.com`

**CI Pipeline:**
- Not detected (manual deployment)

**Supabase Edge Functions:**
- Deployed to Supabase cloud (Sao Paulo)
- 9 functions: admin-user, chatbot-ia, cloudflare-metrics, data-api, flightaware-proxy, fr24-proxy, get-dashboard-stats, send-email, send-notification-email
- All functions disable gateway JWT verification (`supabase/functions/config.toml`)
- Each function handles its own auth internally (prevents 401 without CORS headers)

## Environment Configuration

**Required env vars (client-side, `.env`):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Optional env vars (client-side):**
- `VITE_SENTRY_DSN` - Sentry error tracking DSN
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

**Server-side env vars (Supabase Edge Functions):**
- `SUPABASE_URL` - Supabase URL (auto-provided)
- `SUPABASE_ANON_KEY` - Anon key (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin operations)
- `FLIGHTAWARE_API_KEY` - FlightAware AeroAPI key
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- SMTP credentials (host, port, user, password) - for nodemailer

**Secrets location:**
- Client secrets: `.env` file (gitignored)
- Server secrets: Supabase dashboard (Edge Function environment variables)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (email is direct SMTP, not webhook-based)

## Compatibility Layer

**Base44 Migration Adapter:**
- `src/api/base44Client.js` - Proxy-based compatibility layer from original Base44 BaaS
- Provides unified API: `base44.entities`, `base44.auth`, `base44.integrations`, `base44.functions`
- Entity names auto-converted: CamelCase -> snake_case for Supabase tables
- Function invocation: local functions first (`src/functions/*.js` via `import.meta.glob`), then Edge Functions fallback
- Implementation: `src/functions/_invokeFunction.js`

---

*Integration audit: 2026-03-26*
