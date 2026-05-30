-- 0003_catalog_definitions.sql
--
-- Migration to the JSONB-blob-per-collection model.
--
-- Before this migration, catalog_collections and catalog_entries were plain
-- tables created in 0001_init.sql but never populated (the plugin doesn't
-- write to them). This migration:
--
--   1. Creates `collection_definitions` — the new canonical store, one row
--      per collection, with the full JSON definition as a JSONB blob.
--   2. Creates `collection_definitions_history` — append-only audit log,
--      populated by a trigger when `version` changes (i.e. on real edits;
--      plugin mirror writes that leave version untouched generate no
--      history).
--   3. Drops the old (empty) catalog_collections / catalog_entries tables.
--   4. Recreates them as a VIEW + MATERIALIZED VIEW over the JSONB blob,
--      so the website's existing queries work unchanged.
--
-- The materialized view is refreshed explicitly by writers (plugin mirror,
-- editor save action in Phase 4). No refresh trigger — refresh-on-every-row
-- would be O(N) per upsert.

-- ─── helper: strip Minecraft color codes ────────────────────────────────────
-- Mirrors `ChatColor.stripColor(StringUtils.color(...))` from the plugin.
-- IMMUTABLE so it can be used inside the materialized view and in indexes.
CREATE OR REPLACE FUNCTION strip_color(s TEXT) RETURNS TEXT AS $$
DECLARE r TEXT;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  r := regexp_replace(s, '&#[0-9a-fA-F]{6}', '', 'g');
  r := regexp_replace(r, '[&§][0-9a-fk-or]', '', 'gi');
  RETURN r;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── canonical store ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_definitions (
  identifier  TEXT PRIMARY KEY,
  json_blob   JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

CREATE INDEX IF NOT EXISTS collection_definitions_updated_at_idx
  ON collection_definitions (updated_at DESC);

-- ─── history (audit log) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_definitions_history (
  id           BIGSERIAL PRIMARY KEY,
  identifier   TEXT NOT NULL,
  json_blob    JSONB NOT NULL,
  version      INTEGER NOT NULL,
  replaced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replaced_by  TEXT
);

CREATE INDEX IF NOT EXISTS collection_definitions_history_identifier_idx
  ON collection_definitions_history (identifier, replaced_at DESC);

-- Snapshot trigger — fires only when `version` changes. Plugin-mirror writes
-- leave `version` alone, so they don't pollute history. Editor (Phase 4) +
-- Restore (Phase 5) both bump version, so both naturally generate history.
-- No DELETE trigger: plugin's mirror does delete-missing-rows as a maintenance
-- op, and those aren't edit events.
CREATE OR REPLACE FUNCTION snapshot_collection_history() RETURNS trigger AS $$
BEGIN
  INSERT INTO collection_definitions_history(identifier, json_blob, version, replaced_by)
  VALUES (OLD.identifier, OLD.json_blob, OLD.version, OLD.updated_by);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS collection_definitions_history_trigger ON collection_definitions;
CREATE TRIGGER collection_definitions_history_trigger
  AFTER UPDATE ON collection_definitions
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION snapshot_collection_history();

-- ─── drop the placeholder tables from 0001_init.sql ─────────────────────────
-- Re-runs: 0003 may have already replaced catalog_entries with a matview.
DROP MATERIALIZED VIEW IF EXISTS catalog_entries CASCADE;
DROP TABLE IF EXISTS catalog_entries CASCADE;
DROP VIEW IF EXISTS catalog_collections CASCADE;
DROP TABLE IF EXISTS catalog_collections CASCADE;

-- ─── catalog_collections: regular view ──────────────────────────────────────
-- One row per collection. Small. A view is enough; no index needed.
CREATE OR REPLACE VIEW catalog_collections AS
  SELECT identifier,
         strip_color(json_blob->>'displayName')   AS display_name_plain,
         json_blob->>'displayName'                 AS display_name_raw,
         json_blob->>'menuIcon'                    AS menu_icon,
         (json_blob->>'menuData')::int             AS menu_data,
         json_blob->>'type'                        AS type,
         (json_blob->>'menuWeight')::int           AS menu_weight,
         updated_at
  FROM collection_definitions;

-- ─── catalog_entries: materialized view (needs the GIN trigram index) ───────
-- One row per entry. Refreshed explicitly by writers (plugin mirror after
-- batch upsert; editor save action).
CREATE MATERIALIZED VIEW catalog_entries AS
  SELECT (e->>'identifier')                                  AS identifier,
         d.identifier                                        AS collection_id,
         strip_color(e->>'displayName')                      AS display_name_plain,
         e->>'displayName'                                   AS display_name_raw,
         e->>'material'                                      AS material,
         (e->>'menuWeight')::int                             AS menu_weight,
         lower(
           coalesce(strip_color(e->>'displayName'),'')
           || ' ' ||
           coalesce(strip_color(d.json_blob->>'displayName'),'')
           || ' ' ||
           coalesce(e->>'identifier','')
         )                                                   AS search_text,
         d.updated_at
  FROM collection_definitions d,
       jsonb_array_elements(d.json_blob->'entries') e;

-- Unique index is required by REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX catalog_entries_pk_idx
  ON catalog_entries (identifier, collection_id);

CREATE INDEX catalog_entries_search_idx
  ON catalog_entries USING gin (search_text gin_trgm_ops);

-- Initial refresh so the matview is populated. No-op on first migrate (empty
-- collection_definitions) but safe to include.
REFRESH MATERIALIZED VIEW catalog_entries;
