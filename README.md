# collectionlog-admin

Web admin for the [CollectionLogReloaded](https://github.com/ItWasEnder/CollectionLogReloaded) Minecraft plugin. Lets staff search the collection catalog, view a player's progress, and grant or revoke individual items / full collections safely against the live data store.

## Quick start

```bash
pnpm install
pnpm db:seed         # builds mock.db with realistic fake data
pnpm dev             # http://localhost:3000
```

The dev server runs against an in-process PGlite database persisted to `mock.db` — no Docker, no on-prem connection needed. Production runs against the on-prem Postgres that MCPlus already writes to.

## Where to read next

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what we're building, in what order
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the moving parts and how they talk
- **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** — Postgres schema + the JSONB shape we read/write
- **[docs/CONTRACTS.md](docs/CONTRACTS.md)** — the three artifacts shared between plugin and website
- **[docs/MESSAGING.md](docs/MESSAGING.md)** — the MCPlus pub/sub layer this depends on
- **[docs/DEV_SETUP.md](docs/DEV_SETUP.md)** — running locally, regenerating the mock DB
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — why we chose what (ADRs)

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Drizzle ORM
- PGlite (dev) / node-postgres (prod)
- NextAuth (Auth.js v5) with Discord OAuth
- Vercel for hosting; on-prem Postgres for prod data
