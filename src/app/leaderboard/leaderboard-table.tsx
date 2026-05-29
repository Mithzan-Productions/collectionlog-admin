"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlayerHead } from "@/components/player-head";
import type { LeaderboardRow } from "@/db/queries";

type SortKey = "normal_logs" | "prestige_logs" | "entries";

const SORT_META: Record<SortKey, { label: string }> = {
  normal_logs: { label: "normal" },
  prestige_logs: { label: "prestige" },
  entries: { label: "entries" },
};

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("normal_logs");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const filterRef = useRef<HTMLInputElement>(null);

  // 'f' focuses filter when not in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f") {
        e.preventDefault();
        filterRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = rows;
    if (q) {
      list = list.filter(
        (r) => r.name?.toLowerCase().includes(q) || r.uuid.toLowerCase().startsWith(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av === bv) return (a.name ?? "").localeCompare(b.name ?? "");
      return (av - bv) * dir;
    });
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  // Rank tracks the underlying ordering — when filtered, we still want #1 to
  // reflect their overall rank in the active sort, not their position within
  // the filtered slice. So compute ranks against the sorted-but-unfiltered list.
  const sortedFull = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av === bv) return (a.name ?? "").localeCompare(b.name ?? "");
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const rankByUuid = useMemo(() => {
    const m = new Map<string, number>();
    sortedFull.forEach((r, i) => m.set(r.uuid, i + 1));
    return m;
  }, [sortedFull]);

  return (
    <div className="space-y-4 settle" style={{ animationDelay: "120ms" }}>
      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-dim)]" />
          <Input
            ref={filterRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter by name or uuid — press f"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="label-tiny mr-2">sort by</span>
          {(Object.keys(SORT_META) as SortKey[]).map((k) => (
            <SortPill
              key={k}
              label={SORT_META[k].label}
              active={sortKey === k}
              dir={sortKey === k ? sortDir : null}
              onClick={() => toggleSort(k)}
            />
          ))}
        </div>
      </div>

      {/* Result line */}
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
        showing <span className="text-[var(--color-fg-muted)]">{filtered.length}</span> of{" "}
        <span className="text-[var(--color-fg-muted)]">{rows.length}</span>
        {query && (
          <>
            {" "}· q: <span className="text-[var(--color-lime)]">{query}</span>
          </>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-10 text-center font-mono text-xs text-[var(--color-fg-muted)]">
          [ no_matches ]
        </div>
      ) : (
        <div className="border border-[var(--color-rule-2)] bg-[var(--color-paper)]">
          <div className="grid grid-cols-[64px_1fr_repeat(3,minmax(0,110px))] items-center gap-4 border-b border-dashed border-[var(--color-rule-2)] px-4 py-2.5">
            <span className="label-tiny">rank</span>
            <span className="label-tiny">player</span>
            <span className="label-tiny text-right">normal</span>
            <span className="label-tiny text-right">prestige</span>
            <span className="label-tiny text-right">entries</span>
          </div>
          <ul>
            {filtered.map((r) => {
              const rank = rankByUuid.get(r.uuid) ?? 0;
              const podium = rank > 0 && rank <= 3;
              const tone =
                rank === 1
                  ? "var(--color-lime)"
                  : rank === 2
                    ? "var(--color-vellum)"
                    : rank === 3
                      ? "var(--color-amber)"
                      : "var(--color-fg-muted)";
              return (
                <li key={r.uuid}>
                  <Link
                    href={`/players/${r.uuid}` as Route}
                    className="grid grid-cols-[64px_1fr_repeat(3,minmax(0,110px))] items-center gap-4 border-b border-dashed border-[var(--color-rule)] px-4 py-3 text-sm transition last:border-b-0 hover:bg-[var(--color-paper-2)]"
                  >
                    <span
                      className={
                        "font-mono tabular-nums " +
                        (podium ? "display text-[28px] leading-none" : "text-[var(--color-fg-dim)]")
                      }
                      style={podium ? { color: tone } : undefined}
                    >
                      {podium ? `#${rank}` : String(rank).padStart(2, "0")}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <PlayerHead name={r.name} size={32} />
                      <span className="min-w-0 truncate font-medium">{r.name ?? "(unnamed)"}</span>
                    </span>
                    <Num value={r.normal_logs} highlight={sortKey === "normal_logs"} />
                    <Num value={r.prestige_logs} highlight={sortKey === "prestige_logs"} />
                    <Num value={r.entries} highlight={sortKey === "entries"} muted />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Num({ value, highlight, muted }: { value: number; highlight?: boolean; muted?: boolean }) {
  return (
    <span
      className={
        "text-right font-mono tabular-nums " +
        (highlight
          ? "text-[var(--color-lime)]"
          : muted
            ? "text-[var(--color-fg-muted)]"
            : "text-[var(--color-fg)]")
      }
    >
      {value.toLocaleString()}
    </span>
  );
}

function SortPill({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc" | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition " +
        (active
          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
          : "border-[var(--color-rule-2)] bg-[var(--color-paper)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-dim)] hover:text-[var(--color-fg)]")
      }
    >
      <span>{label}</span>
      {active && dir === "desc" && <ArrowDown className="h-3 w-3" />}
      {active && dir === "asc" && <ArrowUp className="h-3 w-3" />}
    </button>
  );
}
