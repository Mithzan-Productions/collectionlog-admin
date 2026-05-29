/**
 * Query helpers. Keep all SQL in this file so server components stay clean.
 */
import { db, rawQuery, NAMESPACE } from "./client";
import { catalogCollections, catalogEntries, playerData, type LogHolder } from "./schema";
import { eq, asc } from "drizzle-orm";

// ─── catalog ─────────────────────────────────────────────────────────────────
export async function listCollections() {
  return db.select().from(catalogCollections).orderBy(asc(catalogCollections.menuWeight));
}

export type CollectionWithCount = {
  identifier: string;
  displayNamePlain: string;
  displayNameRaw: string | null;
  menuIcon: string | null;
  type: string | null;
  menuWeight: number | null;
  entryCount: number;
};

/**
 * Like {@link listCollections} but with a per-collection entry count.
 * One trip, single aggregate join.
 */
export async function listCollectionsWithCounts(): Promise<CollectionWithCount[]> {
  const rows = await rawQuery<{
    identifier: string;
    display_name_plain: string;
    display_name_raw: string | null;
    menu_icon: string | null;
    type: string | null;
    menu_weight: number | null;
    entry_count: number;
  }>(
    `SELECT c.identifier,
            c.display_name_plain,
            c.display_name_raw,
            c.menu_icon,
            c.type,
            c.menu_weight,
            COALESCE(COUNT(e.identifier), 0)::int AS entry_count
       FROM catalog_collections c
       LEFT JOIN catalog_entries e ON e.collection_id = c.identifier
      GROUP BY c.identifier
      ORDER BY c.menu_weight ASC NULLS LAST, c.display_name_plain ASC`,
  );
  return rows.map((r) => ({
    identifier: r.identifier,
    displayNamePlain: r.display_name_plain,
    displayNameRaw: r.display_name_raw,
    menuIcon: r.menu_icon,
    type: r.type,
    menuWeight: r.menu_weight,
    entryCount: Number(r.entry_count),
  }));
}

export async function getCollection(id: string) {
  const rows = await db
    .select()
    .from(catalogCollections)
    .where(eq(catalogCollections.identifier, id));
  return rows[0] ?? null;
}

export async function listEntriesForCollection(collectionId: string) {
  return db
    .select()
    .from(catalogEntries)
    .where(eq(catalogEntries.collectionId, collectionId))
    .orderBy(asc(catalogEntries.menuWeight));
}

/**
 * Fuzzy search over entry names. Uses pg_trgm similarity.
 */
export async function searchEntries(query: string, limit = 50) {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  // Substring match (ILIKE) catches everything a user expects; word_similarity
  // ranks fuzzy/typo matches. Both go through the gin_trgm index.
  const rows = await rawQuery<{
    identifier: string;
    collection_id: string;
    display_name_plain: string;
    display_name_raw: string | null;
    material: string | null;
    score: number;
  }>(
    `SELECT identifier, collection_id, display_name_plain, display_name_raw, material,
            GREATEST(
              word_similarity($1, search_text),
              CASE WHEN search_text ILIKE '%' || $1 || '%' THEN 1.0 ELSE 0 END
            ) AS score
       FROM catalog_entries
      WHERE search_text ILIKE '%' || $1 || '%'
         OR word_similarity($1, search_text) > 0.3
      ORDER BY score DESC, display_name_plain ASC
      LIMIT $2`,
    [q, limit],
  );
  return rows;
}

// ─── players ─────────────────────────────────────────────────────────────────
export type PlayerListRow = {
  uuid: string;
  name: string;
  entry_count: number;
  updated_at: string;
};

export async function listPlayers(searchName?: string, limit = 100): Promise<PlayerListRow[]> {
  const ns = NAMESPACE;
  const params: unknown[] = [ns, limit];
  let whereClause = "";
  if (searchName?.trim()) {
    whereClause = "AND lower(data->$1->>'name') LIKE $3";
    params.push(`%${searchName.toLowerCase()}%`);
  }
  const rows = await rawQuery<PlayerListRow>(
    `SELECT uuid::text AS uuid,
            data->$1->>'name' AS name,
            COALESCE(jsonb_array_length(data->$1->'entries'), 0)::int AS entry_count,
            updated_at::text AS updated_at
       FROM player_data
      WHERE data ? $1 ${whereClause}
      ORDER BY name ASC NULLS LAST
      LIMIT $2`,
    params,
  );
  return rows;
}

export async function getPlayer(uuid: string): Promise<LogHolder | null> {
  const rows = await db
    .select({ data: playerData.data })
    .from(playerData)
    .where(eq(playerData.uuid, uuid));
  if (rows.length === 0) return null;
  const ns = (rows[0].data as Record<string, unknown>)[NAMESPACE];
  return (ns as LogHolder) ?? null;
}

// ─── mutations (call the SQL functions) ──────────────────────────────────────
export async function grantEntries(
  uuid: string,
  entries: { identifier: string; collectionId: string }[],
): Promise<number> {
  const result = await rawQuery<{ grant_entries: number }>(
    `SELECT grant_entries($1::uuid, $2::text, $3::jsonb) AS grant_entries`,
    [uuid, NAMESPACE, JSON.stringify(entries)],
  );
  return result[0]?.grant_entries ?? 0;
}

export async function revokeEntries(
  uuid: string,
  entries: { identifier: string; collectionId: string }[],
): Promise<number> {
  const result = await rawQuery<{ revoke_entries: number }>(
    `SELECT revoke_entries($1::uuid, $2::text, $3::jsonb) AS revoke_entries`,
    [uuid, NAMESPACE, JSON.stringify(entries)],
  );
  return result[0]?.revoke_entries ?? 0;
}

export async function entriesForGrantingCollection(collectionId: string) {
  return db
    .select({ identifier: catalogEntries.identifier, collectionId: catalogEntries.collectionId })
    .from(catalogEntries)
    .where(eq(catalogEntries.collectionId, collectionId));
}

export type ProgressRow = {
  collection_id: string;
  display_name_plain: string;
  display_name_raw: string | null;
  menu_icon: string | null;
  type: string | null;
  granted: number;
  total: number;
};

export async function progressByCollection(uuid: string): Promise<ProgressRow[]> {
  const ns = NAMESPACE;
  const rows = await rawQuery<ProgressRow>(
    `WITH granted AS (
       SELECT (e->>'collectionId') AS collection_id, COUNT(*)::int AS granted
         FROM player_data p,
              jsonb_array_elements(COALESCE(p.data->$1->'entries', '[]'::jsonb)) e
        WHERE p.uuid = $2::uuid
        GROUP BY 1
     ),
     totals AS (
       SELECT collection_id, COUNT(*)::int AS total
         FROM catalog_entries
        GROUP BY 1
     )
     SELECT c.identifier AS collection_id,
            c.display_name_plain,
            c.display_name_raw,
            c.menu_icon,
            c.type,
            COALESCE(g.granted, 0) AS granted,
            COALESCE(t.total, 0)   AS total
       FROM catalog_collections c
       LEFT JOIN granted g ON g.collection_id = c.identifier
       LEFT JOIN totals  t ON t.collection_id = c.identifier
      ORDER BY c.menu_weight ASC NULLS LAST, c.display_name_plain ASC`,
    [ns, uuid],
  );
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function isOnline(uuid: string): Promise<boolean> {
  // In prod we'd check Redis or a `players_online` projection. Always false in mock.
  return false;
}

/**
 * Granted entries for a player, joined to the catalog so we can render
 * colored names in the revoke list. Returns rows ordered by collection
 * menu_weight, then entry menu_weight.
 *
 * Entries whose catalog row has been deleted (e.g. catalog re-sync removed
 * them) still appear so the operator can revoke stale grants — their
 * display name falls back to the raw identifier.
 */
export type GrantedEntryRow = {
  identifier: string;
  collection_id: string;
  display_name_plain: string | null;
  display_name_raw: string | null;
  collection_display_plain: string | null;
  collection_display_raw: string | null;
  ts: number | null;
};

export async function listGrantedEntries(uuid: string): Promise<GrantedEntryRow[]> {
  const ns = NAMESPACE;
  const rows = await rawQuery<GrantedEntryRow>(
    `WITH granted AS (
       SELECT (e->>'identifier')   AS identifier,
              (e->>'collectionId') AS collection_id,
              ((e->>'_ts')::bigint) AS ts
         FROM player_data p,
              jsonb_array_elements(COALESCE(p.data->$1->'entries', '[]'::jsonb)) e
        WHERE p.uuid = $2::uuid
     )
     SELECT g.identifier,
            g.collection_id,
            e.display_name_plain,
            e.display_name_raw,
            c.display_name_plain AS collection_display_plain,
            c.display_name_raw   AS collection_display_raw,
            g.ts
       FROM granted g
       LEFT JOIN catalog_entries     e ON e.identifier = g.identifier AND e.collection_id = g.collection_id
       LEFT JOIN catalog_collections c ON c.identifier = g.collection_id
      ORDER BY c.menu_weight ASC NULLS LAST,
               e.menu_weight ASC NULLS LAST,
               g.identifier ASC`,
    [ns, uuid],
  );
  return rows;
}

/**
 * Lightweight collection picker list (id + plain + raw display names) used
 * by the "Grant entire collection" select.
 */
export async function listCollectionsForPicker() {
  return db
    .select({
      identifier: catalogCollections.identifier,
      displayNamePlain: catalogCollections.displayNamePlain,
      displayNameRaw: catalogCollections.displayNameRaw,
    })
    .from(catalogCollections)
    .orderBy(asc(catalogCollections.menuWeight));
}

export type LeaderboardRow = {
  uuid: string;
  name: string;
  normal_logs: number;
  prestige_logs: number;
  entries: number;
};

/**
 * Top players ranked by total_normal_logs (matches in-game /logstats).
 *
 * Source: `clr_log_stats` (owned by the CollectionLogReloaded plugin).
 * Joins MCPlus's `player_data` to surface a third "entries granted" column.
 *
 * A player can appear in `clr_log_stats` without a corresponding `player_data`
 * row (or vice-versa) — both joins are LEFT so neither side filters the other.
 */
export async function leaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const ns = NAMESPACE;
  const rows = await rawQuery<LeaderboardRow>(
    `SELECT s.player_id::text AS uuid,
            s.player_name AS name,
            s.total_normal_logs   AS normal_logs,
            s.total_prestige_logs AS prestige_logs,
            COALESCE(jsonb_array_length(p.data->$1->'entries'), 0)::int AS entries
       FROM clr_log_stats s
       LEFT JOIN player_data p ON p.uuid = s.player_id
      ORDER BY s.total_normal_logs DESC,
               s.total_prestige_logs DESC,
               s.player_name ASC
      LIMIT $2`,
    [ns, limit],
  );
  return rows;
}
