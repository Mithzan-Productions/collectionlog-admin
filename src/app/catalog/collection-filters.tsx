"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ColoredText } from "@/components/colored-text";
import type { CollectionWithCount } from "@/db/queries";

type Props = {
  collections: CollectionWithCount[];
};

const ALL = "__ALL__";

/**
 * Dense, filterable list of collections.
 *
 * Type filter is single-select (ALL or one type) — multi-select adds chrome
 * without much win when there are only ~4 distinct types.
 */
export function CollectionFilters({ collections }: Props) {
  const [activeType, setActiveType] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Distinct types in stable, intuitive order: types appear in the order they
  // first show up in the (menu-weight ordered) collection list.
  const types = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of collections) {
      const t = c.type ?? "UNTYPED";
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [collections]);

  // "f" focuses the name filter (when not already in an input/textarea).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "f") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      filterInputRef.current?.focus();
      filterInputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Apply filters. Group by type, preserving the menu_weight ordering inside.
  const { filtered, total, byType } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = collections.filter((c) => {
      if (activeType !== ALL && (c.type ?? "UNTYPED") !== activeType) return false;
      if (!needle) return true;
      return (
        c.displayNamePlain.toLowerCase().includes(needle) ||
        c.identifier.toLowerCase().includes(needle)
      );
    });
    const grouped = new Map<string, CollectionWithCount[]>();
    for (const c of matches) {
      const t = c.type ?? "UNTYPED";
      const list = grouped.get(t) ?? [];
      list.push(c);
      grouped.set(t, list);
    }
    return { filtered: matches, total: collections.length, byType: grouped };
  }, [collections, activeType, q]);

  const visibleTypes = activeType === ALL ? types : [activeType];

  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 border border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-tiny mr-2">type ──</span>
          <TypePill
            label="ALL"
            count={total}
            active={activeType === ALL}
            onClick={() => setActiveType(ALL)}
          />
          {types.map((t) => {
            const c = collections.reduce(
              (n, x) => ((x.type ?? "UNTYPED") === t ? n + 1 : n),
              0,
            );
            return (
              <TypePill
                key={t}
                label={t}
                count={c}
                active={activeType === t}
                onClick={() => setActiveType(t)}
              />
            );
          })}
        </div>

        <div className="relative flex items-center gap-2 lg:min-w-[280px]">
          <span className="label-tiny shrink-0">filter ~</span>
          <input
            ref={filterInputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name or identifier…"
            aria-label="Filter collections by name or identifier"
            className="h-8 min-w-0 flex-1 border border-[var(--color-rule-2)] bg-[var(--color-ink)] px-2 font-mono text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-lime)] focus:outline-none"
          />
          <kbd
            aria-hidden
            className="hidden border border-[var(--color-rule-2)] bg-[var(--color-ink)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-dim)] lg:inline"
          >
            f
          </kbd>
        </div>
      </div>

      {/* Result count line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
        <span>
          showing{" "}
          <span className="text-[var(--color-lime)]">
            {filtered.length.toLocaleString()}
          </span>{" "}
          of <span className="text-[var(--color-fg)]">{total.toLocaleString()}</span>
        </span>
        {(activeType !== ALL || q.trim().length > 0) && (
          <span className="text-[var(--color-fg-dim)]">──</span>
        )}
        {activeType !== ALL && (
          <span>
            <span className="text-[var(--color-fg-dim)]">type:</span>{" "}
            <span className="text-[var(--color-lime)]">{activeType}</span>
          </span>
        )}
        {activeType !== ALL && q.trim().length > 0 && (
          <span className="text-[var(--color-fg-dim)]">·</span>
        )}
        {q.trim().length > 0 && (
          <span>
            <span className="text-[var(--color-fg-dim)]">q:</span>{" "}
            <span className="text-[var(--color-vellum)]">&quot;{q.trim()}&quot;</span>
          </span>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-16 text-center font-mono text-sm">
          <div className="text-[var(--color-lime)]">[ no_matches ]</div>
          <div className="mt-3 text-xs text-[var(--color-fg-muted)]">
            no collections match
            {activeType !== ALL && (
              <>
                {" "}
                type{" "}
                <span className="text-[var(--color-lime)]">{activeType}</span>
              </>
            )}
            {q.trim() && (
              <>
                {" "}
                {activeType !== ALL ? "and " : ""}q{" "}
                <span className="text-[var(--color-vellum)]">
                  &quot;{q.trim()}&quot;
                </span>
              </>
            )}
            .
          </div>
        </div>
      ) : (
        <div className="border border-[var(--color-rule-2)] bg-[var(--color-paper)]">
          {visibleTypes.map((t) => {
            const rows = byType.get(t) ?? [];
            return <TypeSection key={t} type={t} rows={rows} />;
          })}
        </div>
      )}
    </section>
  );
}

function TypePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex h-7 items-center gap-1.5 border px-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors " +
        (active
          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
          : "border-[var(--color-rule-2)] bg-[var(--color-ink)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-dim)] hover:text-[var(--color-fg)]")
      }
    >
      <span>{label}</span>
      <span
        className={
          "tabular-nums text-[10px] " +
          (active ? "text-[var(--color-lime)]" : "text-[var(--color-fg-dim)]")
        }
      >
        {count}
      </span>
    </button>
  );
}

function TypeSection({
  type,
  rows,
}: {
  type: string;
  rows: CollectionWithCount[];
}) {
  return (
    <div className="border-b border-[var(--color-rule-2)] last:border-b-0">
      {/* Sticky section header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper-2)] px-4 py-2 backdrop-blur-sm">
        <div className="label-tiny">
          <span className="text-[var(--color-fg-muted)]">{type.toLowerCase()}</span>
          <span className="mx-2 text-[var(--color-fg-dim)]">──</span>
          <span className="text-[var(--color-lime)]">{rows.length}</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          entries
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-3 font-mono text-xs text-[var(--color-fg-dim)]">
          [ ] no collections in this type
        </div>
      ) : (
        <ul role="list">
          {rows.map((c) => (
            <li key={c.identifier}>
              <Row collection={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ collection: c }: { collection: CollectionWithCount }) {
  const empty = c.entryCount === 0;
  return (
    <Link
      href={`/catalog/${c.identifier}` as Route}
      className="group grid h-9 grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,18rem)_minmax(0,12rem)_5rem_1.5rem] items-center gap-3 border-b border-dashed border-[var(--color-rule)] px-4 text-sm transition-colors last:border-b-0 hover:bg-[var(--color-paper-2)]"
    >
      {/* Status glyph */}
      <span
        aria-hidden
        className={
          "glyph font-mono text-[11px] " +
          (empty
            ? "text-[var(--color-fg-dim)]"
            : "text-[var(--color-lime)] group-hover:text-[var(--color-lime)]")
        }
      >
        {empty ? "[ ]" : "[*]"}
      </span>

      {/* Colored display name */}
      <span className="min-w-0 truncate text-[var(--color-fg)]">
        <ColoredText raw={c.displayNameRaw} fallback={c.displayNamePlain} />
      </span>

      {/* Identifier in mono */}
      <span className="label-tiny truncate text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg-muted)]">
        {c.identifier}
      </span>

      {/* materials/icon hint */}
      <span
        className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)]"
        title={c.menuIcon ?? "no icon"}
      >
        {c.menuIcon ? (
          <span className="hex-chip">{c.menuIcon}</span>
        ) : (
          <span className="opacity-50">—</span>
        )}
      </span>

      {/* Entry count, right-aligned */}
      <span
        className={
          "text-right font-mono tabular-nums text-[12px] " +
          (empty
            ? "text-[var(--color-fg-dim)]"
            : "text-[var(--color-fg)] group-hover:text-[var(--color-lime)]")
        }
      >
        {c.entryCount.toLocaleString()}
      </span>

      {/* Chevron */}
      <span
        aria-hidden
        className="font-mono text-[11px] text-[var(--color-fg-dim)] transition-transform group-hover:translate-x-[1px] group-hover:text-[var(--color-lime)]"
      >
        ──&gt;
      </span>
    </Link>
  );
}
