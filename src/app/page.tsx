import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">CollectionLog admin</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Browse the collection catalog, view player progress, and grant or revoke entries.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/catalog"
          className="block rounded border bg-[var(--color-panel)] p-5 transition hover:bg-[var(--color-panel-2)]"
        >
          <div className="mb-1 text-sm font-mono text-[var(--color-accent)]">/catalog</div>
          <div className="font-medium">Catalog</div>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Search collectables by friendly name. Powered by Postgres trigram search.
          </p>
        </Link>

        <Link
          href="/players"
          className="block rounded border bg-[var(--color-panel)] p-5 transition hover:bg-[var(--color-panel-2)]"
        >
          <div className="mb-1 text-sm font-mono text-[var(--color-accent)]">/players</div>
          <div className="font-medium">Players</div>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            View a player&apos;s collection progress, grant or revoke entries.
          </p>
        </Link>
      </section>

      <section className="rounded border bg-[var(--color-panel)] p-5 text-sm text-[var(--color-fg-muted)]">
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--color-fg)]">
          Dev tips
        </div>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            Regenerate fake data with <code className="font-mono text-[var(--color-accent-2)]">pnpm db:seed</code>
          </li>
          <li>
            All design docs live in <code className="font-mono">docs/</code> at the repo root
          </li>
          <li>
            See <code className="font-mono">ROADMAP.md</code> for what&apos;s built and what&apos;s next
          </li>
        </ul>
      </section>
    </div>
  );
}
