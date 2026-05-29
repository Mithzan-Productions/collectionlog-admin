# Contracts between plugin and website

Three artifacts cross the repo boundary. Each has one source of truth and a one-way generation path.

## 1. `LogHolder` JSON Schema

**Source of truth:** the Java POJO `LogHolder` (and the JSON shape produced by `LogHolderAdapter`) in the CollectionLogReloaded repo.

**Why:** the data we read from `player_data.data->'collectionlog'` is whatever the plugin serialized. The plugin owns the shape; the website consumes it.

**Generation path:**

```
CollectionLogReloaded/pom.xml
  └─ victools/jsonschema-generator (build plugin)
     └─ produces target/logholder.schema.json
        └─ attached to GitHub Release as an asset

collectionlog-admin/scripts/sync-schema.ts
  └─ downloads logholder.schema.json from the latest CLR release tag
  └─ json-schema-to-typescript → src/lib/contracts/logholder.types.ts
```

Pinned by release tag in `collectionlog-admin/.env` (or a `contracts.json` file). Bump the pin → CI regenerates types → website rebuilds. **The website never edits the generated types file.**

## 2. Postgres migrations

**Source of truth:** this repo (`collectionlog-admin/src/db/migrations/*.sql`).

**Why:** the catalog projection tables and `grant_entries` are the website's contribution to the schema. The plugin only needs to know "these tables exist and have this shape" — easy to keep in sync via a single migration file.

**What's in here:**
- `0001_catalog.sql` — `catalog_collections`, `catalog_entries`, `pg_trgm`, the GIN index
- `0002_grant_entries.sql` — the `grant_entries` and `revoke_entries` functions

**What's NOT in here:** the `player_data` table itself. That belongs to MCPlus and lives in `mcplus-platform-core/database-core/src/main/kotlin/platform/database/PlayerDataTable.kt`. Our migrations assume it exists. The seed script for dev creates it because PGlite has nothing.

## 3. MessageBus envelope

**Source of truth:** the MCPlus `messaging` module (new, see [MESSAGING.md](MESSAGING.md)).

**Why:** both the website (TS publisher) and the plugin (Java/Kotlin subscriber) need to agree on the envelope and the payload shape for every message type. One spec, both sides codegen against it.

**Generation path:**

```
mcplus-platform-core/messaging/
  └─ build.gradle.kts (jsonschema-generator task)
     └─ produces messaging-envelopes.schema.json
        └─ attached to MCPlus GitHub Release

collectionlog-admin/scripts/sync-schema.ts
  └─ downloads messaging-envelopes.schema.json
  └─ json-schema-to-typescript → src/lib/contracts/envelopes.types.ts
```

## Repo-level layout

| Artifact | Owner repo | Consumer repos | Transport |
|---|---|---|---|
| `LogHolder` JSON Schema | CollectionLogReloaded | collectionlog-admin | GitHub Release asset |
| Postgres migrations | collectionlog-admin | DBA / CI | direct |
| MessageBus envelope schema | mcplus-platform-core | CollectionLogReloaded, collectionlog-admin | GitHub Release asset |

No third "contracts" repo. Each artifact lives where its owner lives; consumers pull from releases. This avoids the "shared package no one wants to maintain" pattern.

## Versioning rules

- **Schema artifacts are pinned by release tag**, never `latest`. A website build at commit X always pulls the same schema as the build before it unless the pin moves.
- **Envelope `version` field is monotonic.** Subscribers handle the versions they know and skip anything newer (logged + dropped). Adding a new field to a payload bumps the schema but not the version; renaming or removing a field bumps the version.
- **Migrations are append-only.** Once a numbered migration is shipped, it doesn't get edited; we add a new one to fix mistakes.
