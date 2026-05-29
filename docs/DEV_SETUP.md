# Dev setup

## Requirements

- Node 20+
- pnpm 9+ (use `corepack enable` if you don't have it)

That's it. No Docker, no Postgres install, no Redis.

## First run

```bash
pnpm install
pnpm db:seed        # generates mock.db with realistic fake data
pnpm dev            # http://localhost:3000
```

`db:seed` runs every migration against an in-process [PGlite](https://github.com/electric-sql/pglite) instance, persists it to `mock.db` in the repo root, and inserts a few hundred fake collections, entries, and players. The file is gitignored — regenerate as needed.

## What's in the mock data

- ~12 collections with friendly hex-colored names and various item icons
- ~600 entries across all collections, each with a friendly name and material
- ~50 fake players, each with a random subset of entries granted (timestamps backdated)
- A few "edge case" players: empty holder, holder with every entry, holder with a renamed entry

The seed script lives in `scripts/seed.ts`. Tweak the constants at the top to scale up.

## Switching to real Postgres

Set `DATABASE_URL` in `.env.local` to a Postgres connection string. The app picks the driver based on whether `DATABASE_URL` starts with `postgres://` (real) or is unset (PGlite + `mock.db`).

```bash
# .env.local
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
```

Run migrations against it once:

```bash
pnpm db:migrate
```

## Resetting

```bash
rm mock.db
pnpm db:seed
```

## Verifying the grant flow without a real plugin

In dev, the MessageBus publish is a no-op stub that logs to console and inserts into `dev_messagebus_log`. You can verify the publish happened by querying that table:

```bash
pnpm db:repl
> select * from dev_messagebus_log order by id desc limit 5;
```

`pnpm db:repl` opens a Drizzle-based REPL against the current DB (PGlite or real).

## Running types codegen

```bash
pnpm contracts:sync       # downloads the latest LogHolder + envelope schemas, regenerates TS
```

By default pulls from the release tags pinned in `contracts.json`. Bump the pin manually.

## Test users (auth)

In dev, `NEXTAUTH_DEV_BYPASS=1` lets you sign in as any email without a real OAuth flow. Set the env var in `.env.local`:

```bash
NEXTAUTH_DEV_BYPASS=1
```

Sign in with anything and you're logged in as that email. Disabled in production builds.

## Scripts cheatsheet

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm db:seed` | Wipe `mock.db`, run migrations, seed fake data |
| `pnpm db:migrate` | Run migrations only (against `DATABASE_URL` if set, else `mock.db`) |
| `pnpm db:repl` | Open a Postgres REPL against the current DB |
| `pnpm contracts:sync` | Refresh generated TS types from upstream JSON Schemas |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
