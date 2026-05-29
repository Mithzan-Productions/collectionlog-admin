# Roadmap

Ordered by dependency. Each phase produces something demoable locally against `mock.db`.

## Phase 0 — Foundation (this commit)

- Repo scaffold (Next.js 15 + TS + Tailwind v4 + shadcn/ui)
- Design docs (this directory)
- PGlite-backed DB layer with `catalog_*` schema and seed
- `grant_entries` / `revoke_entries` SQL functions
- App shell with empty routes for `/catalog` and `/players`

**Demo:** site loads, navigation works, "no data" states render.

## Phase 1 — Catalog browsing

- `/catalog` page: list collections with item counts
- `/catalog/[id]` page: list entries in a collection with rendered colored names
- Fuzzy search box that hits `catalog_entries` via `pg_trgm`
- A color-code → React renderer for `&#hex` strings

**Demo:** search "halo" → finds "Mystic Halo" in "Advanced Collection". Click a collection, see its entries.

## Phase 2 — Player view

- `/players` page: paginated list of UUIDs + names from `player_data`
- `/players/[uuid]` page: render a player's `LogHolder` slice — collections with progress (`X / Y`), entries grouped by collection
- Read path only — no mutations yet

**Demo:** pick a player, see their progress, expand collections to see what's granted.

## Phase 3 — Grant flow

- Fuzzy search across catalog from within a player page
- "Grant" button → calls `grant_entries(uuid, 'collectionlog', [...])` → publishes `holder.reload` (stub in dev)
- "Grant entire collection" button on a collection's row
- "Revoke" button on a granted entry → mirrors via `revoke_entries`
- Confirmation modal with the count of items about to change

**Demo:** select a player, search for "Reaper", grant all matching. Refresh — entries are there.

## Phase 4 — Auth

- NextAuth with Discord OAuth
- Allowlist via env (`ADMIN_DISCORD_IDS=...`)
- Middleware redirects unauthenticated users to `/auth/signin`
- Audit log table written by every mutation server action

**Demo:** sign in via Discord, only allowlisted users get past `/auth/signin`. Every grant/revoke leaves a row in `audit_log`.

## Phase 5 — Plugin integration (cross-repo)

This phase touches CollectionLogReloaded and mcplus-platform-core.

- MCPlus: new `messaging` module (typed pub/sub layer)
- CollectionLogReloaded: catalog sync writer (post-`CollectionManager.load`)
- CollectionLogReloaded: `holder.reload` subscriber in `MCPlusPlayerManager`
- mcplus-platform-core: `messaging-envelopes.schema.json` published in release
- CollectionLogReloaded: `logholder.schema.json` published in release
- `pnpm contracts:sync` wired up in this repo's CI

**Demo:** end-to-end against a real test server. Grant an item to an online player → they see the change reflected without a relog.

## Phase 6 — Polish

- Real-time presence (Redis SUBSCRIBE in a server action edge function) — show "player is online" badge
- Bulk operations (grant N items across M players, queued)
- Diff view for what changed since last visit
- Light/dark theme toggle
- Mobile layout pass

## Out of scope for v1

- Editing config files (collections, rewards, titles) via the UI — needs writeable on-disk config or a config-mirror pattern, not started.
- Granting rewards — has side effects in plugin code; needs a `reward.grant` MessageBus command, not pure SQL.
- Editing titles (prefix/suffix) — same reason.
- Multi-server fanout — assumes single-cluster MCPlus today.
