/**
 * Build mock.db from scratch:
 *   1. Delete the existing file.
 *   2. Run migrations.
 *   3. Insert realistic fake catalogs and players.
 *
 * The data is deterministic (seeded RNG) so reruns produce the same DB.
 */
import { existsSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MOCK_DB = join(ROOT, "mock.db");
const MIGRATIONS_DIR = join(ROOT, "src", "db", "migrations");
const NAMESPACE = "collectionlog";

// ─── deterministic RNG ───────────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = rng(20260528);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const range = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const slice = <T,>(arr: readonly T[], n: number) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
};

function stripColor(s: string): string {
  return s.replace(/&#[0-9a-fA-F]{6}/g, "").replace(/§[0-9a-fk-or]/gi, "").replace(/&[0-9a-fk-or]/gi, "");
}

// ─── fake data sources ───────────────────────────────────────────────────────
const PALETTE = ["#52ff57", "#b69cff", "#ffd166", "#06d6a0", "#ef476f", "#118ab2", "#f78c6b", "#9b5de5"];

function colorize(text: string): string {
  // Apply a single hex color, or a gradient across letters for half the cases
  const useGradient = rand() < 0.35;
  if (!useGradient) {
    return `&${PALETTE[Math.floor(rand() * PALETTE.length)].replace("#", "#")}${text}`.replace(
      /&(#[0-9a-fA-F]{6})/,
      "&$1",
    );
  }
  const start = pick(PALETTE);
  const end = pick(PALETTE);
  return text
    .split("")
    .map((ch, i) => {
      const t = i / Math.max(1, text.length - 1);
      const c = lerpHex(start, end, t);
      return ch === " " ? ch : `&${c}${ch}`;
    })
    .join("");
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16));
  const pb = b.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Types must match the plugin's CollectionType enum:
//   NORMAL, BOSS, PRESTIGE_NORMAL, PRESTIGE_BOSS, HIDDEN
const COLLECTIONS = [
  // ── NORMAL ────────────────────────────────────────────────────────────────
  { id: "mining_basics",       name: "Mining Basics",        icon: "DIAMOND_PICKAXE",      type: "NORMAL" },
  { id: "fishing_haul",        name: "Fishing Haul",         icon: "FISHING_ROD",          type: "NORMAL" },
  { id: "advanced_collection", name: "Advanced Collection",  icon: "PAPER",                type: "NORMAL" },
  { id: "rare_finds",          name: "Rare Finds",           icon: "ENCHANTED_BOOK",       type: "NORMAL" },
  { id: "trinkets",            name: "Trinkets",             icon: "AMETHYST_SHARD",       type: "NORMAL" },
  { id: "armor_anthology",     name: "Armor Anthology",      icon: "DIAMOND_CHESTPLATE",   type: "NORMAL" },
  { id: "potion_brewer",       name: "Potion Brewer",        icon: "BREWING_STAND",        type: "NORMAL" },
  { id: "food_critic",         name: "Food Critic",          icon: "GOLDEN_APPLE",         type: "NORMAL" },
  { id: "exploration",         name: "Exploration",          icon: "COMPASS",              type: "NORMAL" },
  { id: "enchanting_lore",     name: "Enchanting Lore",      icon: "ENCHANTING_TABLE",     type: "NORMAL" },
  { id: "farming",             name: "Farming",              icon: "WHEAT",                type: "NORMAL" },
  { id: "building_blocks",     name: "Building Blocks",      icon: "BRICKS",               type: "NORMAL" },
  { id: "tools_of_trade",      name: "Tools of the Trade",   icon: "ANVIL",                type: "NORMAL" },
  { id: "deep_dark",           name: "Deep Dark Expedition", icon: "ECHO_SHARD",           type: "NORMAL" },

  // ── BOSS ──────────────────────────────────────────────────────────────────
  { id: "boss_drops",          name: "Boss Drops",           icon: "NETHER_STAR",          type: "BOSS" },
  { id: "weapons_master",      name: "Weapons Master",       icon: "NETHERITE_SWORD",      type: "BOSS" },
  { id: "raider_war",          name: "Raider War",           icon: "OMINOUS_BANNER_PATTERN", type: "BOSS" },

  // ── PRESTIGE_NORMAL ───────────────────────────────────────────────────────
  { id: "mining_prestige",     name: "Mining Prestige",      icon: "NETHERITE_PICKAXE",    type: "PRESTIGE_NORMAL" },
  { id: "fishing_prestige",    name: "Fishing Prestige",     icon: "PUFFERFISH",           type: "PRESTIGE_NORMAL" },
  { id: "armor_prestige",      name: "Armor Prestige",       icon: "NETHERITE_CHESTPLATE", type: "PRESTIGE_NORMAL" },

  // ── PRESTIGE_BOSS ─────────────────────────────────────────────────────────
  { id: "boss_drops_prestige", name: "Boss Drops Prestige",  icon: "DRAGON_HEAD",          type: "PRESTIGE_BOSS" },
  { id: "weapons_prestige",    name: "Weapons Prestige",     icon: "MACE",                 type: "PRESTIGE_BOSS" },

  // ── HIDDEN ────────────────────────────────────────────────────────────────
  { id: "wandering_trader",    name: "Wandering Trader",     icon: "EMERALD",              type: "HIDDEN" },
  { id: "hidden_caches",       name: "Hidden Caches",        icon: "BUNDLE",               type: "HIDDEN" },
  { id: "halloween_2026",      name: "Halloween 2026",       icon: "JACK_O_LANTERN",       type: "HIDDEN" },
  { id: "summer_2026",         name: "Summer Splash 2026",   icon: "TROPICAL_FISH",        type: "HIDDEN" },
];

const MATERIALS = [
  "DIAMOND", "EMERALD", "GOLD_INGOT", "IRON_INGOT", "NETHERITE_INGOT", "AMETHYST_SHARD",
  "BLAZE_ROD", "ENDER_PEARL", "DRAGON_EGG", "TRIDENT", "ELYTRA", "TOTEM_OF_UNDYING",
  "SHIELD", "BOW", "CROSSBOW", "MUSIC_DISC_13", "NAUTILUS_SHELL", "HEART_OF_THE_SEA",
];

const ENTRY_WORDS = [
  ["Mystic", "Ancient", "Cursed", "Blessed", "Frozen", "Burning", "Shattered", "Pristine", "Wandering", "Eternal"],
  ["Halo", "Crown", "Blade", "Shield", "Charm", "Sigil", "Relic", "Talisman", "Pendant", "Ring", "Fragment", "Skull", "Tooth", "Eye", "Heart"],
  ["of Light", "of Shadow", "of the Deep", "of the Forge", "of Storms", "of Ash", "of Bone", "of the Void", "", "", ""],
];

function fakeEntryName(): string {
  return [pick(ENTRY_WORDS[0]), pick(ENTRY_WORDS[1]), pick(ENTRY_WORDS[2])].filter(Boolean).join(" ").trim();
}

const FAKE_PLAYERS = [
  "ItWasEnder", "ReaperKing", "MysticFox42", "BlazingPhoenix", "ShadowWalker", "FrostByte",
  "Pyromancer99", "Crystalline", "VoidWalker", "DiamondDigger", "NetherKnight", "EmeraldEyes",
  "AzureFlame", "RogueAssassin", "PaladinLight", "ChronoMage", "Stormbreaker", "Geomancer",
  "Thornroot", "Skyforger", "Inkblot", "TidalSurge", "EmberQuill", "DraconisRex",
  "VespertineX", "WarlockMoon", "GiltedSeraph", "RuneSinger", "ObsidianFang", "FrayedBanner",
  "NimbusVale", "QuartzGlimmer", "OrioleFinch", "HelixCipher", "BoreasArc", "TwilightFen",
  "WyldKindler", "AshenMaiden", "BroketownPete", "OrbitalDecay", "CinderHymn", "VermillionGale",
  "Quincept", "Slipstream", "MaribelDusk", "NixOphidian", "Saltbrook", "BraidedComet",
  "PaleHarvester", "OneEyedOwl",
];

function uuidFromName(name: string): string {
  // Deterministic UUIDv4-shape from name. Build a 32-char hex string, then slice 8-4-4-4-12.
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  // 4 8-char chunks = 32 hex chars
  let s = hex(h) + hex(Math.imul(h, 31)) + hex(Math.imul(h, 17)) + hex(Math.imul(h, 13));
  // version 4 nibble at position 12, variant nibble (8/9/a/b) at position 16
  s = s.slice(0, 12) + "4" + s.slice(13, 16) + "8" + s.slice(17);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

// ─── seed ────────────────────────────────────────────────────────────────────
async function seed() {
  if (existsSync(MOCK_DB)) {
    console.log("[seed] removing existing mock.db");
    rmSync(MOCK_DB, { recursive: true, force: true });
  }

  const pg = new PGlite(`file://${MOCK_DB}`, { extensions: { pg_trgm } });

  // migrations
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    console.log(`[seed] migrate ${f}`);
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }

  // catalog
  type Entry = { identifier: string; collectionId: string; raw: string; plain: string; material: string };
  const allEntries: Entry[] = [];

  for (const c of COLLECTIONS) {
    const raw = colorize(c.name);
    const plain = stripColor(raw);
    await pg.query(
      `INSERT INTO catalog_collections(identifier, display_name_plain, display_name_raw, menu_icon, type, menu_weight)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [c.id, plain, raw, c.icon, c.type, COLLECTIONS.indexOf(c)],
    );

    const n = range(20, 70);
    const usedNames = new Set<string>();
    for (let i = 0; i < n; i++) {
      let name = fakeEntryName();
      while (usedNames.has(name)) name = fakeEntryName();
      usedNames.add(name);
      const rawN = colorize(name);
      const plainN = stripColor(rawN);
      const material = pick(MATERIALS);
      const identifier = `${c.id}_${plainN.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${i}`;
      const searchText = `${plainN} ${plain} ${identifier}`.toLowerCase();
      await pg.query(
        `INSERT INTO catalog_entries(identifier, collection_id, display_name_plain, display_name_raw, material, menu_weight, search_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [identifier, c.id, plainN, rawN, material, i, searchText],
      );
      allEntries.push({ identifier, collectionId: c.id, raw: rawN, plain: plainN, material });
    }
  }

  // players
  const now = Date.now();
  for (let i = 0; i < FAKE_PLAYERS.length; i++) {
    const name = FAKE_PLAYERS[i];
    const uuid = uuidFromName(name);

    // Each player gets 0..70% of the catalog at random
    const portion = rand();
    let granted: Entry[];
    if (i === 0) granted = []; // empty holder edge case
    else if (i === 1) granted = [...allEntries]; // completionist edge case
    else granted = slice(allEntries, Math.floor(allEntries.length * portion * 0.7));

    const entries = granted.map((e) => ({
      identifier: e.identifier,
      collectionId: e.collectionId,
      _ts: now - range(60_000, 60 * 60 * 24 * 90 * 1000),
    }));

    const data = {
      [NAMESPACE]: {
        uuid,
        name,
        prefix: "none",
        suffix: "none",
        "super-suffix": "none",
        entries,
        "claimed-rewards": [],
      },
    };

    await pg.query(
      `INSERT INTO player_data(uuid, data, updated_at) VALUES ($1, $2, NOW())`,
      [uuid, JSON.stringify(data)],
    );
  }

  // summary
  const collCount = (await pg.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM catalog_collections`))
    .rows[0].count;
  const entryCount = (await pg.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM catalog_entries`))
    .rows[0].count;
  const playerCount = (await pg.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM player_data`))
    .rows[0].count;

  console.log(`[seed] done: ${collCount} collections, ${entryCount} entries, ${playerCount} players → mock.db`);
  await pg.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
