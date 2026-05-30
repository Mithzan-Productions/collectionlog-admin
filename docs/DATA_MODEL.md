# Data model

Three layers: MCPlus's `player_data` (untouched), the plugin-owned `clr_log_stats` (read-only for us), and the **catalog** — a JSONB-blob-per-collection store the plugin mirrors to (with website-owned views/matviews on top of it).

## Catalog: `collection_definitions` + views

```sql
-- Canonical store. Plugin's SqlCatalogProvider upserts to this table on every
-- CollectionManager.load() when Catalog.source = mirror.
CREATE TABLE collection_definitions (
  identifier  TEXT PRIMARY KEY,
  json_blob   JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

-- Audit log. Populated by an AFTER UPDATE trigger keyed on version change, so
-- plugin-mirror writes (which don't bump version) don't pollute it. The website's
-- Phase-4 editor + Phase-5 restore both bump version → both leave history.
CREATE TABLE collection_definitions_history (
  id           BIGSERIAL PRIMARY KEY,
  identifier   TEXT NOT NULL,
  json_blob    JSONB NOT NULL,
  version      INTEGER NOT NULL,
  replaced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replaced_by  TEXT
);
```

`catalog_collections` is a plain VIEW over `collection_definitions` (small, no index needed). `catalog_entries` is a MATERIALIZED VIEW (one row per `(identifier, collection_id)`, ~5k rows, with the GIN trigram index that powers fuzzy search). Both are defined in `0003_catalog_definitions.sql`.

**Refresh discipline:** the matview is refreshed explicitly by writers — the plugin's `SqlCatalogProvider.mirror()` calls `REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_entries` at the end of its batch; the Phase-4 editor save action will do the same after committing the new blob. No trigger-based refresh — refresh-per-row would be O(N) per upsert.

**JSONB shape:** the blob matches the plugin's existing JSON file format (the same shape Gson produces from `LogCollection`). Keys consumed by the views: `displayName`, `menuIcon`, `menuData`, `type`, `menuWeight`, `entries[]`. Anything else in the JSON is preserved but ignored by views.

## Plugin-owned tables (read-only contracts)

### `clr_log_stats` — leaderboard counters

Owned by the CollectionLogReloaded plugin's `SqlStatProvider`. We never write here; the website only `SELECT`s. Lives in the same Postgres database as MCPlus's `player_data` (the plugin is configured to point at the same DB).

```sql
-- Owned by the plugin, not by this repo's migrations
CREATE TABLE clr_log_stats (
  id                  SERIAL PRIMARY KEY,
  player_id           UUID NOT NULL UNIQUE,
  player_name         TEXT NOT NULL,
  total_normal_logs   INTEGER NOT NULL DEFAULT 0,
  total_prestige_logs INTEGER NOT NULL DEFAULT 0
);
```

- `total_normal_logs` = `countCompleted(IS_DEFAULT)` — count of **individual entries** the player has in NORMAL / BOSS / HIDDEN collections. (Misleading name — "logs" here means "log entries," not "completed collections." `countCompleted` in `LogHolder.java` flatMaps every granted entry and filters by collection type.)
- `total_prestige_logs` = `countCompleted(IS_PRESTIGE)` — count of entries the player has in PRESTIGE_NORMAL or PRESTIGE_BOSS collections.
- `total_normal_logs + total_prestige_logs` ≈ total entry count from `player_data.data->'collectionlog'->'entries'`. Will differ only if entries reference collections that no longer exist in the catalog.
- Plugin updates this table async-batched on every entry grant via `StatsManager.updateStats(holder)`. Also written in bulk on `/clr datasave` and shutdown.
- The in-game `/logstats` command reads this table (60s-polled cache).

The website's leaderboard surfaces these exact numbers so operators can spot-check against `/logstats`.

## MCPlus tables (read-only contract)

We do **not** own these. MCPlus's `PlayerDataTable.kt` is authoritative. We read it and we call our own `grant_entries(...)` function that operates on it.

```sql
-- Owned by MCPlus, do not migrate from this repo
CREATE TABLE player_data (
  uuid       UUID PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### The JSONB shape (under namespace `collectionlog`)

The `data` column is multi-tenant: each plugin owns a top-level key. Our slice looks like this (derived from `LogHolderAdapter.java`):

```jsonc
{
  "collectionlog": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PlayerName",
    "prefix": "title_id_or_none",
    "suffix": "title_id_or_none",
    "super-suffix": "title_id_or_none",
    "entries": [
      { "identifier": "adv_halo_item", "collectionId": "advanced_collection", "_ts": 1735689600000 }
    ],
    "claimed-rewards": ["reward_id_1"]
  },
  // ...other plugins' namespaces live alongside
}
```

**Identity of an entry: `(identifier, collectionId)`.** This is the composite key both at the Java side (`LogEntry.equals/hashCode`) and at our DB merge layer.

## Catalog projection (we own these)

These tables exist so the website can fuzzy-search collectables by their friendly names without parsing YAML/JSON configs at the MC server's filesystem. The plugin writes them on `CollectionManager.load()` (boot + reload).

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE catalog_collections (
  identifier         TEXT PRIMARY KEY,
  display_name_plain TEXT NOT NULL,    -- color codes stripped, search-ready
  display_name_raw   TEXT,             -- original "&#787878Advanced..." for display
  menu_icon          TEXT,
  menu_data          INT,
  type               TEXT,
  menu_weight        INT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE catalog_entries (
  identifier         TEXT NOT NULL,
  collection_id      TEXT NOT NULL REFERENCES catalog_collections(identifier) ON DELETE CASCADE,
  display_name_plain TEXT NOT NULL,
  display_name_raw   TEXT,
  material           TEXT,
  menu_weight        INT,
  search_text        TEXT NOT NULL,    -- entry name + collection name + identifier joined
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, collection_id)
);

CREATE INDEX catalog_entries_search_idx
  ON catalog_entries USING gin (search_text gin_trgm_ops);
```

### Color stripping

Configs have names like `"&#787878A&#60A573d&#48D26Fv... Collection"`. On the plugin side, strip them with `ChatColor.stripColor(StringUtils.color(raw))` — `StringUtils.color` converts `&#hex` to legacy section codes, then `stripColor` removes those. Store both the stripped (`display_name_plain`) and the raw (`display_name_raw`) values. The website renders the raw form with a small TS color codec; search and sort use the plain form.

### Sync semantics

The plugin's catalog sync is an upsert-everything-then-delete-missing pass:

```sql
-- pseudocode
BEGIN;
  UPSERT INTO catalog_collections ...;
  UPSERT INTO catalog_entries ...;
  DELETE FROM catalog_collections WHERE identifier NOT IN (...);
  DELETE FROM catalog_entries WHERE (identifier, collection_id) NOT IN (...);
COMMIT;
```

Cheap (a few hundred rows total) and means the DB reflects exactly what the plugin currently has loaded.

## The mutation primitive: `grant_entries(...)`

The one and only function the website uses to add entries to a player. Atomic, dedup-safe, namespace-aware.

```sql
CREATE OR REPLACE FUNCTION grant_entries(
  p_uuid      UUID,
  p_namespace TEXT,
  p_new       JSONB        -- array of { identifier, collectionId }
)
RETURNS INT AS $$
DECLARE
  root JSONB;
  existing_keys TEXT[];
  to_add JSONB;
  added INT;
BEGIN
  SELECT data INTO root FROM player_data WHERE uuid = p_uuid FOR UPDATE;
  root := COALESCE(root, '{}'::jsonb);

  -- dedupe against existing (identifier, collectionId) composite keys
  SELECT array_agg((e->>'identifier') || ':' || (e->>'collectionId'))
    INTO existing_keys
    FROM jsonb_array_elements(COALESCE(root #> ARRAY[p_namespace,'entries'], '[]'::jsonb)) e;

  SELECT jsonb_agg(
           jsonb_build_object(
             'identifier',   e->>'identifier',
             'collectionId', e->>'collectionId',
             '_ts',          (EXTRACT(EPOCH FROM NOW())*1000)::bigint
           )
         )
    INTO to_add
    FROM jsonb_array_elements(p_new) e
    WHERE ((e->>'identifier') || ':' || (e->>'collectionId'))
          <> ALL(COALESCE(existing_keys,'{}'));

  IF to_add IS NULL THEN RETURN 0; END IF;

  root := jsonb_set(
    root,
    ARRAY[p_namespace,'entries'],
    COALESCE(root #> ARRAY[p_namespace,'entries'], '[]'::jsonb) || to_add
  );

  INSERT INTO player_data(uuid, data, updated_at)
    VALUES (p_uuid, root, NOW())
    ON CONFLICT (uuid) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

  SELECT jsonb_array_length(to_add) INTO added;
  RETURN added;
END $$ LANGUAGE plpgsql;
```

**Properties we rely on:**
- `FOR UPDATE` locks the row, so concurrent grants don't race.
- The function rejects duplicate `(identifier, collectionId)` pairs silently — same semantics as `LogMap.put` returning false.
- Always namespaced, so we can't accidentally write into another plugin's slice.
- Returns the count actually inserted, which the UI displays as feedback.

## Revoking

Mirror function, same shape:

```sql
CREATE OR REPLACE FUNCTION revoke_entries(p_uuid UUID, p_namespace TEXT, p_keys JSONB)
RETURNS INT ...
```

`p_keys` is the same `[{identifier, collectionId}]` shape. We filter the JSON array in place, drop matching elements, write back.

## What we do NOT write directly

- **`prefix` / `suffix` / `super-suffix`** — these reference `Title` identifiers from `TitleManager` configs. Out of scope for now; would need the plugin to expose available titles via a similar catalog table.
- **`claimed-rewards`** — same reason. Rewards have side effects (`reward.executeRevoke(holder)`), so granting a reward via SQL would skip the effect. If we want this, the plugin needs to handle it via a `reward.grant` MessageBus command.

This is intentional: the safe surface is "entries in a collection." Anything with side effects goes through the plugin via the bus.

## Online players: the cache problem

When a player is online, the plugin holds an in-memory `LogHolder` and will write it back on save, overwriting our DB changes. Solved by publishing a `holder.reload` envelope on the MessageBus after every successful `grant_entries` call. See [MESSAGING.md](MESSAGING.md).

For offline players the cache problem doesn't exist — next login pulls fresh from `player_data`.
