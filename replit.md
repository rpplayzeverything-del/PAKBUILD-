# Pakistan PC Price Calculator

A responsive custom PC builder for Pakistan that estimates complete desktop builds in PKR from entry-level to enthusiast parts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pc-price-calculator/src/App.tsx` — calculator state, filters, quote desk, compatibility checks, and local save/load actions.
- `artifacts/pc-price-calculator/src/data/catalog.ts` — local Pakistani-market sample catalog and PKR estimate data.
- `artifacts/pc-price-calculator/src/index.css` — shared visual theme, grid texture, typography, and motion.

## Architecture decisions

- The first release is frontend-only so the calculator remains fast and usable without retailer accounts or an external pricing API.
- The catalog is intentionally local and explicitly labeled as approximate street estimates; users are prompted to verify stock, tax, exchange rate, and warranty with retailers.
- Build state is persisted in the browser with localStorage rather than server-side accounts.

## Product

- Users can switch between Intel and AMD, choose a budget tier, filter parts by category/brand/search, build a live quote, and review estimated power/socket compatibility.
- Optional monitor and accessory quantities are included in totals.
- Users can save/load/reset builds locally and copy a retailer-ready summary.

## User preferences

- Use PKR and Pakistani-market terminology throughout the calculator.

## Gotchas

- Prices are estimates, not live quotes. Treat catalog updates as data changes in `src/data/catalog.ts`.
- The Vite build expects `PORT` and `BASE_PATH` from the managed workflow; use the workflow for preview runs.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
