# Decisions

Architectural decisions and why. Append-only — when a decision is reversed, add a new entry that supersedes it rather than editing the old one.

---

## ADR-001: Separate repo for the website, not a monorepo

**Date:** 2026-05-28

**Decision:** The website lives in `collectionlog-admin`, separate from CollectionLogReloaded and mcplus-platform-core.

**Why:**
- Different toolchains (Maven/Java vs pnpm/Next.js) — monorepo coordination would slow both sides down.
- Release cadences are different: plugin tagged ad-hoc, website deploys on every push.
- The contract surface between them is tiny (three artifacts, see [CONTRACTS.md](CONTRACTS.md)) — no atomic-PR pressure across repos.

**Tradeoff:** schema bumps require a coordinated commit in two repos. Mitigated by pinning schemas by release tag and treating the pin bump as an ordinary PR in the website repo.

---

## ADR-002: Website talks directly to Postgres, not through a plugin API

**Date:** 2026-05-28

**Decision:** All reads and writes from the website go straight to the on-prem Postgres. The plugin does not expose an HTTP API.

**Why:**
- Postgres is already publicly reachable (operator's choice). The "expose plugin HTTP" option doesn't reduce attack surface meaningfully but adds a server lifecycle to maintain.
- Grant semantics are naturally atomic at the DB level: `FOR UPDATE` row lock + JSONB merge + return count in a single `grant_entries(...)` call. Recreating that over HTTP would be lossier.
- Cache invalidation for online players is one Redis pub/sub message — also a one-liner, no need to go through HTTP.

**Tradeoff:** any future operation with non-data side effects (kicking a player, running a command, granting a reward that fires effects) still needs the bus. Accepted — those go through a `*.command` MessageBus channel.

---

## ADR-003: Catalog projection (not on-disk YAML access)

**Date:** 2026-05-28

**Decision:** The plugin writes a flattened catalog projection (`catalog_collections`, `catalog_entries`) to Postgres on `CollectionManager.load()`. The website reads from these tables.

**Why:**
- Friendly-name fuzzy search needs trigram indexing — possible only in the DB, not against on-disk YAML.
- The website would otherwise need to either (a) parse the plugin's YAML format including color codes, or (b) call an HTTP endpoint to fetch catalogs. (a) duplicates parsing logic, (b) reintroduces the plugin HTTP server we rejected in ADR-002.
- Projection is cheap to maintain — a few hundred rows, fully rewritten on plugin reload.

**Tradeoff:** the plugin's catalog and the projection can drift if the sync fails. Mitigated by the publish-`catalog.reload`-after-sync handshake and a "last synced" timestamp the UI surfaces.

---

## ADR-004: PGlite for local dev, Postgres for prod

**Date:** 2026-05-28

**Decision:** Dev runs against an in-process PGlite DB persisted to `mock.db`. Prod runs against on-prem Postgres.

**Why:**
- "Pause and load the website to check the feel" is a primary user requirement. PGlite has zero startup time and no daemon — `pnpm dev` and it just works.
- PGlite supports JSONB and `pg_trgm` (the two features we depend on most), so dev/prod semantics match.
- Avoids dragging Docker into the dev loop.

**Tradeoff:** PGlite is newer and has gaps vs full Postgres. We pin a known-good version and CI runs the same migrations against real Postgres on every PR.

---

## ADR-005: Expand MCPlus with a typed MessageBus

**Date:** 2026-05-28

**Decision:** A new `messaging` module in `mcplus-platform-core` provides typed envelopes, a codec registry, and pattern subscribe. CollectionLogReloaded uses it instead of touching Lettuce directly.

**Why:**
- MCPlus already owns the Redis connection; two plugins each managing their own client is wasted.
- The website needs to publish into the same bus — placing the bus in MCPlus means the envelope spec becomes a single source of truth both sides codegen against.
- Any future plugin under MCPlus gets pub/sub for free.

**Scope (minimal):** typed envelopes, codec registry, multi-channel routing, pattern subscribe. No retries, dead-letter, RPC, or schema registry. Those are different problems; build them when something concretely needs them.

---

## ADR-006: Stack — Next.js + Drizzle + shadcn

**Date:** 2026-05-28

**Decision:** Next.js 15 (App Router), Drizzle ORM, shadcn/ui with Tailwind v4. TypeScript everywhere.

**Why:**
- Next.js + Vercel is the fastest free-tier deploy path.
- Drizzle's introspection over the catalog tables gives us typed queries without an ORM ceremony. JSONB columns we treat as opaque `unknown` and parse with generated `LogHolder` types.
- shadcn isn't a dependency — components are copied into our repo and editable. Avoids being locked into a UI library's design language.

**Tradeoff:** Next.js App Router is opinionated about server actions and caching; we accept that and lean into it (mutations are server actions, reads are RSC).

---

## ADR-007: No third "contracts" repo

**Date:** 2026-05-28

**Decision:** Schema artifacts live in their owner's repo and are published as GitHub Release assets. Consumers pull from releases pinned by tag. No shared `contracts/` package.

**Why:**
- Shared packages without an owner rot.
- The artifacts are small (one JSON Schema each) and rarely change.
- GitHub Releases are zero-cost and pinnable.

**Tradeoff:** the website's CI needs a GitHub PAT to fetch from private release assets if the source repos are private. Acceptable.
