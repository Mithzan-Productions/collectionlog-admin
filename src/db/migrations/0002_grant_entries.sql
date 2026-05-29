-- The one safe write surface for the website.
-- Atomic, dedup-safe, namespace-aware. Mirrors LogMap.put semantics.
CREATE OR REPLACE FUNCTION grant_entries(
  p_uuid      UUID,
  p_namespace TEXT,
  p_new       JSONB
)
RETURNS INTEGER AS $$
DECLARE
  root          JSONB;
  existing_keys TEXT[];
  to_add        JSONB;
  added         INTEGER;
BEGIN
  SELECT data INTO root FROM player_data WHERE uuid = p_uuid FOR UPDATE;
  root := COALESCE(root, '{}'::jsonb);

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

  IF to_add IS NULL OR jsonb_array_length(to_add) = 0 THEN
    RETURN 0;
  END IF;

  -- ensure the namespace object exists before we set into it
  IF NOT (root ? p_namespace) THEN
    root := jsonb_set(root, ARRAY[p_namespace], '{}'::jsonb, true);
  END IF;

  root := jsonb_set(
    root,
    ARRAY[p_namespace,'entries'],
    COALESCE(root #> ARRAY[p_namespace,'entries'], '[]'::jsonb) || to_add,
    true
  );

  INSERT INTO player_data(uuid, data, updated_at)
    VALUES (p_uuid, root, NOW())
    ON CONFLICT (uuid) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

  SELECT jsonb_array_length(to_add) INTO added;
  RETURN added;
END $$ LANGUAGE plpgsql;

-- Symmetric revoke
CREATE OR REPLACE FUNCTION revoke_entries(
  p_uuid      UUID,
  p_namespace TEXT,
  p_keys      JSONB
)
RETURNS INTEGER AS $$
DECLARE
  root         JSONB;
  current_arr  JSONB;
  filtered_arr JSONB;
  remove_keys  TEXT[];
  removed      INTEGER;
BEGIN
  SELECT data INTO root FROM player_data WHERE uuid = p_uuid FOR UPDATE;
  IF root IS NULL THEN RETURN 0; END IF;

  current_arr := COALESCE(root #> ARRAY[p_namespace,'entries'], '[]'::jsonb);

  SELECT array_agg((e->>'identifier') || ':' || (e->>'collectionId'))
    INTO remove_keys
    FROM jsonb_array_elements(p_keys) e;

  SELECT jsonb_agg(e)
    INTO filtered_arr
    FROM jsonb_array_elements(current_arr) e
    WHERE ((e->>'identifier') || ':' || (e->>'collectionId'))
          <> ALL(COALESCE(remove_keys,'{}'));

  removed := jsonb_array_length(current_arr) - COALESCE(jsonb_array_length(filtered_arr), 0);
  IF removed = 0 THEN RETURN 0; END IF;

  root := jsonb_set(root, ARRAY[p_namespace,'entries'], COALESCE(filtered_arr, '[]'::jsonb), true);

  UPDATE player_data SET data = root, updated_at = NOW() WHERE uuid = p_uuid;
  RETURN removed;
END $$ LANGUAGE plpgsql;
