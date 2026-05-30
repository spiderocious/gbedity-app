# Gbedity

An Nx + pnpm monorepo template for building **Gbedity**, a game. This is a scaffold —
the structure is in place; the game itself is not built yet.

## Layout

- `apps/backend` — Node + TypeScript + Express API. MongoDB for persistence. Tests via **Jest**.
- `apps/admin` — Vite + React + TypeScript admin dashboard. Tests via **Vitest**.
- `apps/game` — Vite + React + TypeScript game client. Tests via **Vitest**.
- `packages/ui` — Shared React component library. Exports `Button`. Tests via **Vitest**.

## Commands (run from the repo root)

- `pnpm install` — install all workspace deps (pnpm only; `npm`/`yarn` are blocked).
- `pnpm lint` — lint every project (`nx run-many -t lint`).
- `pnpm typecheck` — typecheck every project.
- `pnpm build` — build every project.
- `pnpm test` — run every project's tests.
- `nx dev backend` / `nx dev admin` / `nx dev game` — run a single app in dev.

## Per-app dev

- backend: http://localhost:8090 (needs MongoDB at `MONGO_URL`, see `apps/backend/.env.example`)
- admin: http://localhost:5174
- game: http://localhost:5173

## Conventions

- Workspace packages are referenced as `@gbedity/<name>` (e.g. `@gbedity/ui`).
- TypeScript is strict everywhere (see `tsconfig.base.json`).
- ESLint config is shared from `eslint.config.mjs` at the root.
