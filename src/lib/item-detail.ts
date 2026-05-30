/**
 * Human-readable labels for catalog entries whose ItemFacade JSON is flattened
 * into each LogEntry (see CollectionLogReloaded LogEntryAdapter + ItemParser).
 */
import { stripColor } from "@/lib/colors";

/** Log entry / ItemFacade JSON as stored in collection_definitions.entries[]. */
export type CatalogEntryJson = Record<string, unknown>;

function extra(entry: CatalogEntryJson): Record<string, unknown> {
  const raw = entry["extra-data"] ?? entry.extraData;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function field(entry: CatalogEntryJson, name: string): unknown {
  const fromExtra = extra(entry)[name];
  if (fromExtra !== undefined && fromExtra !== null) return fromExtra;
  return entry[name];
}

/** "minecraft:strong_healing" → "Strong Healing" */
export function prettyKey(key: string): string {
  const tail = key.includes(":") ? key.split(":").pop()! : key;
  return tail
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "ENCHANTED_BOOK" → "Enchanted Book" */
export function prettyMaterial(material: string | null | undefined): string {
  if (!material) return "";
  return prettyKey(material.toLowerCase());
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function formatEnchantLevel(level: number): string {
  if (level <= 0) return "";
  return ` ${level}`;
}

function formatEnchants(data: unknown): string | null {
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else {
    const obj = asRecord(data);
    if (obj?.enchantments) arr = asArray(obj.enchantments);
  }
  if (arr.length === 0) return null;

  const parts = arr
    .map((el) => {
      const o = asRecord(el);
      if (!o?.type) return null;
      const name = prettyKey(String(o.type));
      const level = Number(o.level ?? 0);
      return name + formatEnchantLevel(level);
    })
    .filter((s): s is string => Boolean(s));

  return parts.length ? parts.join(", ") : null;
}

function formatPotionEffect(effect: Record<string, unknown>): string | null {
  const type = effect.type;
  if (typeof type !== "string" || !type) return null;
  const amp = Number(effect.amplifier ?? 0);
  const base = prettyKey(type);
  return amp > 0 ? `${base} ${amp + 1}` : base;
}

function formatPotion(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj) return null;

  const parts: string[] = [];
  if (typeof obj.type === "string" && obj.type) {
    parts.push(prettyKey(obj.type));
  }
  for (const fx of asArray(obj.customEffects)) {
    const label = formatPotionEffect(asRecord(fx) ?? {});
    if (label) parts.push(label);
  }
  return parts.length ? parts.join(", ") : null;
}

/** Mirrors ItemParser InstrumentData.name(). */
function formatInstrument(data: unknown): string | null {
  const obj = asRecord(data);
  const instrument = obj?.instrument;
  if (typeof instrument !== "string" || !instrument) return null;
  const segment = instrument.includes(":") ? instrument.split(":")[1] : instrument;
  const first = segment.split("_")[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatBook(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj) return null;
  const title = typeof obj.title === "string" ? stripColor(obj.title).trim() : "";
  const author = typeof obj.author === "string" ? obj.author.trim() : "";
  if (title && author) return `${title} (${author})`;
  if (title) return title;
  if (author) return author;
  return null;
}

const AXOLOTL_VARIANTS = ["Lucy", "Wild", "Gold", "Cyan", "Blue"];

function formatAxolotl(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj || obj.variant === undefined) return null;
  const idx = Number(obj.variant);
  return AXOLOTL_VARIANTS[idx] ?? `Variant ${idx}`;
}

function formatOminous(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj) return null;
  const amp = Number(obj.amplifier ?? 0);
  return amp > 0 ? `Amplifier ${amp}` : null;
}

function formatFirework(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj?.type) return null;
  return prettyKey(String(obj.type));
}

function formatArmorTrim(data: unknown): string | null {
  const obj = asRecord(data);
  if (!obj) return null;
  const pattern = typeof obj.pattern === "string" ? prettyKey(obj.pattern) : "";
  const material = typeof obj.material === "string" ? prettyKey(obj.material) : "";
  if (pattern && material) return `${material} ${pattern}`;
  return pattern || material || null;
}

/**
 * Metadata-only label (enchants, potion type, horn, book title, etc.).
 * Empty when the entry has no ItemParser extra-data fields.
 */
export function formatItemDetail(entry: CatalogEntryJson): string {
  const parts = [
    formatEnchants(field(entry, "enchantData")),
    formatPotion(field(entry, "potionData")),
    formatInstrument(field(entry, "instrumentData")),
    formatBook(field(entry, "bookData")),
    formatAxolotl(field(entry, "axolotlData")),
    formatOminous(field(entry, "ominousData")),
    formatFirework(field(entry, "fireworkEffectData")),
    formatArmorTrim(field(entry, "armorTrimData")),
  ].filter((s): s is string => Boolean(s));

  return parts.join(" · ");
}

function isGenericDisplayName(displayPlain: string, materialPlain: string): boolean {
  if (!displayPlain) return true;
  if (!materialPlain) return false;
  return displayPlain.toLowerCase() === materialPlain.toLowerCase();
}

/**
 * Plain label for operators: config display name, or material, plus metadata when needed.
 */
export function formatEntryLabelPlain(entry: CatalogEntryJson): string {
  const material = typeof entry.material === "string" ? entry.material : "";
  const materialPlain = prettyMaterial(material);
  const displayPlain = stripColor(
    typeof entry.displayName === "string" ? entry.displayName : "",
  ).trim();
  const detail = formatItemDetail(entry);

  if (!detail) {
    return displayPlain || materialPlain || String(entry.identifier ?? "");
  }

  if (!displayPlain || isGenericDisplayName(displayPlain, materialPlain)) {
    const base = materialPlain || displayPlain;
    return base ? `${base} — ${detail}` : detail;
  }

  if (displayPlain.toLowerCase().includes(detail.toLowerCase())) {
    return displayPlain;
  }

  return `${displayPlain} — ${detail}`;
}
