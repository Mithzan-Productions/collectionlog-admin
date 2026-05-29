import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── MCPlus's table (we do NOT own this; declared so we can query it) ────────
export const playerData = pgTable("player_data", {
  uuid: uuid("uuid").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull(),
});

// ─── Catalog projection (we own these) ───────────────────────────────────────
export const catalogCollections = pgTable("catalog_collections", {
  identifier: text("identifier").primaryKey(),
  displayNamePlain: text("display_name_plain").notNull(),
  displayNameRaw: text("display_name_raw"),
  menuIcon: text("menu_icon"),
  menuData: integer("menu_data"),
  type: text("type"),
  menuWeight: integer("menu_weight"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const catalogEntries = pgTable(
  "catalog_entries",
  {
    identifier: text("identifier").notNull(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => catalogCollections.identifier, { onDelete: "cascade" }),
    displayNamePlain: text("display_name_plain").notNull(),
    displayNameRaw: text("display_name_raw"),
    material: text("material"),
    menuWeight: integer("menu_weight"),
    searchText: text("search_text").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.collectionId] }),
    searchIdx: index("catalog_entries_search_idx").using(
      "gin",
      sql`${t.searchText} gin_trgm_ops`,
    ),
  }),
);

// ─── CollectionLogReloaded plugin's leaderboard table (read-only) ────────────
// Owned by the plugin (SqlStatProvider). We never write here.
export const clrLogStats = pgTable("clr_log_stats", {
  id: serial("id").primaryKey(),
  playerId: uuid("player_id").notNull().unique(),
  playerName: text("player_name").notNull(),
  totalNormalLogs: integer("total_normal_logs").notNull().default(0),
  totalPrestigeLogs: integer("total_prestige_logs").notNull().default(0),
});

// ─── Dev-only message log (PGlite) ───────────────────────────────────────────
export const devMessagebusLog = pgTable("dev_messagebus_log", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Types ──────────────────────────────────────────────────────────────────
export type CatalogCollection = typeof catalogCollections.$inferSelect;
export type CatalogEntry = typeof catalogEntries.$inferSelect;

/**
 * The shape under `player_data.data->'collectionlog'`.
 * Derived from CollectionLogReloaded's LogHolderAdapter.
 * When we wire up contracts:sync this will be replaced by the generated types.
 */
export type LogHolder = {
  uuid: string;
  name: string;
  prefix?: string;
  suffix?: string;
  "super-suffix"?: string;
  entries: { identifier: string; collectionId: string; _ts: number }[];
  "claimed-rewards"?: string[];
};
