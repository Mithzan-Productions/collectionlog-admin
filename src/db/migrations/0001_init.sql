-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- MCPlus's player_data. Declared here for dev. In prod, MCPlus creates this.
CREATE TABLE IF NOT EXISTS player_data (
  uuid       UUID PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Catalog projection (we own these)
CREATE TABLE IF NOT EXISTS catalog_collections (
  identifier         TEXT PRIMARY KEY,
  display_name_plain TEXT NOT NULL,
  display_name_raw   TEXT,
  menu_icon          TEXT,
  menu_data          INTEGER,
  type               TEXT,
  menu_weight        INTEGER,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_entries (
  identifier         TEXT NOT NULL,
  collection_id      TEXT NOT NULL REFERENCES catalog_collections(identifier) ON DELETE CASCADE,
  display_name_plain TEXT NOT NULL,
  display_name_raw   TEXT,
  material           TEXT,
  menu_weight        INTEGER,
  search_text        TEXT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, collection_id)
);

CREATE INDEX IF NOT EXISTS catalog_entries_search_idx
  ON catalog_entries USING gin (search_text gin_trgm_ops);

-- Owned by the CollectionLogReloaded plugin (SqlStatProvider).
-- Declared here so PGlite (mock dev) has it. In prod the plugin already creates it.
CREATE TABLE IF NOT EXISTS clr_log_stats (
  id                   SERIAL PRIMARY KEY,
  player_id            UUID NOT NULL UNIQUE,
  player_name          TEXT NOT NULL,
  total_normal_logs    INTEGER NOT NULL DEFAULT 0,
  total_prestige_logs  INTEGER NOT NULL DEFAULT 0
);

-- Dev-only: messagebus log for inspecting what the website would publish
CREATE TABLE IF NOT EXISTS dev_messagebus_log (
  id         SERIAL PRIMARY KEY,
  channel    TEXT NOT NULL,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
