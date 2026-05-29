import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Library, Package } from "lucide-react";
import { listCollectionsWithCounts } from "@/db/queries";
import { ColoredText } from "@/components/colored-text";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "./search-box";

export default async function CatalogPage() {
  const collections = await listCollectionsWithCounts();
  const totalEntries = collections.reduce((sum, c) => sum + c.entryCount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded border bg-[var(--color-panel)] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
              <Library className="h-3 w-3" />
              <span>catalog</span>
              <span className="opacity-50">/</span>
              <span className="text-[var(--color-accent)]">index</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Collection catalog
            </h1>
            <p className="max-w-prose text-sm text-[var(--color-fg-muted)]">
              Every collection seeded into <code className="font-mono text-[var(--color-accent-2)]">mock.db</code>.
              Search across entries with trigram-backed fuzzy matching, or pick a collection to browse its contents.
            </p>
          </div>
          <dl className="flex items-stretch gap-4 font-mono text-xs">
            <Stat label="collections" value={collections.length} />
            <Stat label="entries" value={totalEntries} accent />
          </dl>
        </div>
      </section>

      {/* Search */}
      <section>
        <SearchBox />
      </section>

      {/* Grid */}
      {collections.length === 0 ? (
        <div className="rounded border bg-[var(--color-panel)] p-10 text-center text-sm text-[var(--color-fg-muted)]">
          No collections seeded. Run <code className="font-mono text-[var(--color-accent-2)]">pnpm db:seed</code>.
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.identifier}
              href={`/catalog/${c.identifier}` as Route}
              className="group relative flex flex-col gap-4 overflow-hidden rounded border bg-[var(--color-panel)] p-5 transition hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-panel-2)]"
            >
              {/* corner mark */}
              <span
                aria-hidden
                className="absolute right-0 top-0 h-12 w-12 -translate-y-6 translate-x-6 rotate-45 bg-[var(--color-accent)]/0 transition group-hover:bg-[var(--color-accent)]/10"
              />

              <div className="flex items-start gap-3">
                {/* menu icon tile */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-[var(--color-bg)] text-[var(--color-fg-muted)] transition group-hover:border-[var(--color-accent)]/40 group-hover:text-[var(--color-accent)]"
                  aria-hidden
                >
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium leading-tight">
                    <ColoredText raw={c.displayNameRaw} fallback={c.displayNamePlain} />
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
                    /catalog/{c.identifier}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-fg)]" />
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <span
                  className="truncate rounded bg-[var(--color-bg)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]"
                  title={c.menuIcon ?? "no icon"}
                >
                  {c.menuIcon ?? "—"}
                </span>
                <span className="flex items-center gap-2">
                  {c.type && (
                    <Badge variant="default" className="font-mono">
                      {c.type}
                    </Badge>
                  )}
                  <Badge
                    variant={c.entryCount === 0 ? "warn" : "accent"}
                    className="font-mono"
                  >
                    {c.entryCount} {c.entryCount === 1 ? "entry" : "entries"}
                  </Badge>
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded border bg-[var(--color-bg)] px-3 py-2 text-right">
      <div
        className={
          "text-lg font-semibold tabular-nums leading-none " +
          (accent ? "text-[var(--color-accent-2)]" : "text-[var(--color-fg)]")
        }
      >
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
    </div>
  );
}
