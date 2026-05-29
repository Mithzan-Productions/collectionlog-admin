import { listCollectionsWithCounts } from "@/db/queries";
import { SearchBox } from "./search-box";
import { CollectionFilters } from "./collection-filters";

// DB-backed — never prerender at build time
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const collections = await listCollectionsWithCounts();
  const totalEntries = collections.reduce((sum, c) => sum + c.entryCount, 0);
  const typeCount = new Set(collections.map((c) => c.type ?? "UNTYPED")).size;
  const avg =
    collections.length > 0 ? Math.round(totalEntries / collections.length) : 0;

  return (
    <div className="space-y-8">
      {/* ─── Hero strip ─────────────────────────────────────────────────── */}
      <section className="settle">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
          <span>catalog</span>
          <span className="opacity-50">/</span>
          <span className="text-[var(--color-lime)]">index</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <h1 className="display text-[clamp(40px,6vw,64px)] text-[var(--color-fg)]">
            COLLECTION<span className="text-[var(--color-lime)]">/</span>CATALOG
          </h1>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <HeroStat label="collections" value={collections.length} />
            <HeroStat label="entries" value={totalEntries} accent />
            <HeroStat label="avg/collection" value={avg} />
            <HeroStat label="types" value={typeCount} />
          </dl>
        </div>
      </section>

      <hr className="punchline" />

      {/* ─── Entry search ─────────────────────────────────────────────── */}
      <section className="settle" style={{ animationDelay: "120ms" }}>
        <SearchBox />
      </section>

      {/* ─── Filterable collection list ───────────────────────────────── */}
      {collections.length === 0 ? (
        <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-10 text-center font-mono text-sm text-[var(--color-fg-muted)]">
          no collections seeded. run{" "}
          <code className="font-mono text-[var(--color-lime)]">pnpm db:seed</code>.
        </div>
      ) : (
        <div className="settle" style={{ animationDelay: "200ms" }}>
          <CollectionFilters collections={collections} />
        </div>
      )}
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-start">
      <dt className="label-tiny">{label}</dt>
      <dd
        className={
          "font-display text-[28px] leading-none tabular-nums tracking-tight " +
          (accent ? "text-[var(--color-lime)]" : "text-[var(--color-fg)]")
        }
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
