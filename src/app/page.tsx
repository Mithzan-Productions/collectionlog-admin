import Link from "next/link";
import { rawQuery, isMock } from "@/db/client";

// DB-backed — never prerender at build time
export const dynamic = "force-dynamic";

async function summary() {
  const [c] = await rawQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM catalog_collections`);
  const [e] = await rawQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM catalog_entries`);
  const [p] = await rawQuery<{ n: string }>(`SELECT COUNT(*)::text AS n FROM player_data`);
  const [m] = await rawQuery<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM dev_messagebus_log`,
  ).catch(() => [{ n: "0" }]);
  return {
    collections: Number(c?.n ?? 0),
    entries: Number(e?.n ?? 0),
    players: Number(p?.n ?? 0),
    messages: Number(m?.n ?? 0),
  };
}

export default async function Home() {
  const s = await summary();

  return (
    <div className="space-y-12">
      {/* ────── Hero ────── */}
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 settle">
          <div className="label-tiny mb-4">CL/index ── operator console v0.1</div>
          <h1 className="display text-[clamp(56px,9vw,128px)] text-[var(--color-fg)]">
            COLLECTION
            <br />
            <span className="text-[var(--color-lime)]">LOG/</span>
            <span className="text-[var(--color-vellum)]">OPER</span>
          </h1>
          <p className="mt-6 max-w-[52ch] text-sm leading-relaxed text-[var(--color-fg-muted)]">
            Search the catalog. Grant collections to a player. Revoke a single drop.
            Operations land in Postgres atomically and the plugin reloads the holder over
            <span className="text-[var(--color-lime)]"> mcplus</span>.
            Read{" "}
            <Link href={"/catalog" as never} className="text-[var(--color-fg)] underline decoration-[var(--color-lime)] decoration-2 underline-offset-4 hover:text-[var(--color-lime)]">
              /catalog
            </Link>
            , write{" "}
            <Link href={"/players" as never} className="text-[var(--color-fg)] underline decoration-[var(--color-lime)] decoration-2 underline-offset-4 hover:text-[var(--color-lime)]">
              /players
            </Link>
            .
          </p>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="ticket settle" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center justify-between border-b border-dashed border-[var(--color-rule-2)] px-4 py-2">
              <span className="label-tiny">snapshot</span>
              <span className="font-mono text-[10px] text-[var(--color-fg-dim)]">
                {isMock ? "mock.db" : "live"}
              </span>
            </div>
            <dl className="divide-y divide-dashed divide-[var(--color-rule-2)]">
              <Row k="collections" v={s.collections} />
              <Row k="entries" v={s.entries} accent />
              <Row k="players" v={s.players} />
              <Row k="bus.events" v={s.messages} dim />
            </dl>
          </div>
        </aside>
      </section>

      <hr className="punchline" />

      {/* ────── Quick lanes (Leaderboard full-width, then Catalog + Players) ────── */}
      <section
        className="grid gap-px bg-[var(--color-rule-2)] settle"
        style={{ animationDelay: "240ms" }}
      >
        <Lane
          href="/leaderboard"
          code="L-01"
          name="leaderboard"
          desc="Ranked players by completed collections. Click any row to jump to their holder."
          shortcut="g l"
        />
        <div className="grid gap-px bg-[var(--color-rule-2)] md:grid-cols-2">
          <Lane
            href="/catalog"
            code="C-02"
            name="catalog"
            desc="Trigram search across every entry. Browse by collection."
            shortcut="g c"
          />
          <Lane
            href="/players"
            code="P-03"
            name="players"
            desc="Inspect a holder. Grant collections. Revoke drops. Safe-by-default."
            shortcut="g p"
          />
        </div>
      </section>

      {/* ────── Dev tape (hidden in prod) ────── */}
      {isMock && (
        <section className="settle" style={{ animationDelay: "320ms" }}>
          <div className="label-tiny mb-3">CL/devtape</div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-[var(--color-rule-2)] bg-[var(--color-paper)] px-5 py-4 text-xs text-[var(--color-fg-muted)]">
            <Tape label="seed" cmd="pnpm db:seed" />
            <Tape label="repl" cmd="pnpm db:repl" />
            <Tape label="bus log" cmd="select * from dev_messagebus_log;" mono />
            <Tape label="docs" cmd="docs/ROADMAP.md" mono />
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ k, v, accent, dim }: { k: string; v: number; accent?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="label-tiny">{k}</dt>
      <dd
        className={
          "font-display text-[28px] tabular-nums leading-none tracking-tight " +
          (accent
            ? "text-[var(--color-lime)]"
            : dim
              ? "text-[var(--color-fg-dim)]"
              : "text-[var(--color-fg)]")
        }
      >
        {v.toLocaleString()}
      </dd>
    </div>
  );
}

function Lane({
  href,
  code,
  name,
  desc,
  shortcut,
}: {
  href: string;
  code: string;
  name: string;
  desc: string;
  shortcut: string;
}) {
  return (
    <Link
      href={href as never}
      className="group relative flex flex-col gap-6 bg-[var(--color-ink)] p-8 transition hover:bg-[var(--color-paper)]"
    >
      <div className="flex items-center justify-between">
        <span className="label-tiny text-[var(--color-lime-dim)] transition group-hover:text-[var(--color-lime)]">
          {code}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-fg-dim)]">
          <span className="opacity-50">⌘</span> {shortcut}
        </span>
      </div>
      <div>
        <div className="display text-[64px] leading-[0.85] text-[var(--color-fg)] transition group-hover:text-[var(--color-lime)]">
          {name.toUpperCase()}/
        </div>
        <p className="mt-3 max-w-[40ch] text-sm text-[var(--color-fg-muted)]">{desc}</p>
      </div>
      <span
        aria-hidden
        className="absolute right-6 bottom-6 font-mono text-xs text-[var(--color-fg-dim)] transition group-hover:text-[var(--color-lime)] group-hover:translate-x-1"
      >
        ──&gt;
      </span>
    </Link>
  );
}

function Tape({ label, cmd, mono }: { label: string; cmd: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="label-tiny">{label}</span>
      <code className={mono ? "font-mono text-[var(--color-vellum)]" : "font-mono text-[var(--color-lime)]"}>
        {cmd}
      </code>
    </span>
  );
}
