-- Store full LogEntry JSON per row; label formatting lives in src/lib/item-detail.ts
-- (mirrors ItemParser metadata: potions, enchants, horns, books, etc.).

DROP MATERIALIZED VIEW IF EXISTS catalog_entries CASCADE;

CREATE MATERIALIZED VIEW catalog_entries AS
  SELECT (e->>'identifier')                     AS identifier,
         d.identifier                           AS collection_id,
         strip_color(COALESCE(e->>'displayName', '')) AS display_name_plain,
         e->>'displayName'                      AS display_name_raw,
         e->>'material'                         AS material,
         (e->>'menuWeight')::int                AS menu_weight,
         e                                        AS entry_json,
         lower(
           coalesce(strip_color(e->>'displayName'), '')
           || ' ' ||
           coalesce(strip_color(d.json_blob->>'displayName'), '')
           || ' ' ||
           coalesce(e->>'identifier', '')
         )                                      AS search_text,
         d.updated_at
  FROM collection_definitions d,
       jsonb_array_elements(d.json_blob->'entries') e;

CREATE UNIQUE INDEX catalog_entries_pk_idx
  ON catalog_entries (identifier, collection_id);

CREATE INDEX catalog_entries_search_idx
  ON catalog_entries USING gin (search_text gin_trgm_ops);

REFRESH MATERIALIZED VIEW catalog_entries;
