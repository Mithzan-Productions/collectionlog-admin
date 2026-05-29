import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { getCollection, listEntriesForCollection } from "@/db/queries";
import { ColoredText } from "@/components/colored-text";
import { Badge } from "@/components/ui/badge";

type PageProps = { params: Promise<{ id: string }> };

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) notFound();

  const entries = await listEntriesForCollection(id);

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to catalog
        </Link>
      </div>

      {/* Header */}
      <section className="relative overflow-hidden rounded border bg-[var(--color-panel)] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, var(--color-accent), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
              <span>catalog</span>
              <span className="opacity-50">/</span>
              <span className="text-[var(--color-accent)] truncate">{collection.identifier}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              <ColoredText
                raw={collection.displayNameRaw}
                fallback={collection.displayNamePlain}
              />
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" className="font-mono">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </Badge>
              {collection.type && (
                <Badge variant="default" className="font-mono">
                  type: {collection.type}
                </Badge>
              )}
              <span
                className="rounded border bg-[var(--color-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]"
                title={collection.menuIcon ?? "no icon"}
              >
                {collection.menuIcon ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="rounded border bg-[var(--color-panel)] p-10 text-center text-sm text-[var(--color-fg-muted)]">
          This collection has no entries yet.
        </div>
      ) : (
        <section className="overflow-hidden rounded border bg-[var(--color-panel)]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] md:grid-cols-[1fr_220px_140px]">
            <span>entry</span>
            <span className="hidden md:block">identifier</span>
            <span className="text-right">material</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {entries.map((e, i) => (
              <li
                key={`${e.collectionId}:${e.identifier}`}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 transition hover:bg-[var(--color-panel-2)] md:grid-cols-[1fr_220px_140px]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]/60">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  <Package
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)]/50"
                    aria-hidden
                  />
                  <span className="truncate text-sm">
                    <ColoredText
                      raw={e.displayNameRaw}
                      fallback={e.displayNamePlain}
                    />
                  </span>
                </div>
                <code className="hidden truncate font-mono text-[11px] text-[var(--color-fg-muted)] md:block">
                  {e.identifier}
                </code>
                <div className="text-right">
                  {e.material ? (
                    <Badge variant="default" className="font-mono">
                      {e.material}
                    </Badge>
                  ) : (
                    <span className="font-mono text-[10px] text-[var(--color-fg-muted)]/50">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
