# DIROPS-SGA — Sistema de Gestão Aeroportuária (on-premise)

Aplicação de gestão de operações aeroportuárias da SGA (Sociedade Gestora de
Aeroportos, Angola). Controle de voos, tarifas, faturação, segurança (safety),
auditorias, credenciamentos, manutenção e relatórios.

## Stack (on-premise)

- **Frontend:** React 18 + Vite, servido por **nginx**.
- **API/Dados:** **PostgREST** sobre **PostgreSQL 16** (banco `dirops_sga`).
- **Auth:** **GoTrue** (Supabase Auth self-hosted).
- **Functions:** servidor Node próprio (`dirops-functions`) para email, admin de
  utilizadores, geração de relatórios e Data API (Power BI).
- Cliente supabase-js aponta para o nginx local (`@/lib/supabaseClient`), que faz
  proxy para PostgREST (`/rest/v1`) e GoTrue (`/auth/v1`).

> Migrado da nuvem (Supabase Cloud + Base44 + Cloudflare) para infra on-premise.
> O objeto `base44` em `src/api/base44Client.js` é hoje apenas um adaptador local
> sobre supabase-js — não há dependência de cloud/Base44 em runtime.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor de desenvolvimento Vite
npm run build      # build de produção (dist/)
npm run lint       # ESLint
npm run test       # Vitest
```

O deploy on-premise copia `dist/*` para a raiz web do nginx.

## Estrutura

- `src/` — aplicação React (páginas, componentes, entidades, funções client-side).
- `scripts/relatorios/` — geradores dos relatórios automáticos (PDF/HTML/XLSX),
  disparados pelo `dispatcher.mjs` via Task Scheduler (`DIROPS\Relatorios-Dispatcher`).
- `scripts/_archive/` — scripts one-off já executados (migração cloud→on-premise,
  backfills, imports). Mantidos só por histórico; não fazem parte da operação.

O schema SQL vive em `C:\dirops\sga-onpremise\sql\` (migrações numeradas).
