"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, ArrowUp, ArrowDown, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { PlayerHead } from "@/components/player-head";
import type { LeaderboardRow } from "@/db/queries";
import { pollLeaderboardAction } from "./actions";

type SortKey = "normal_logs" | "prestige_logs" | "entries";
type NumericField = SortKey;

const SORT_META: Record<SortKey, { label: string }> = {
  normal_logs: { label: "normal" },
  prestige_logs: { label: "prestige" },
  entries: { label: "entries" },
};

const POLL_INTERVAL_MS = 10_000;
const DELTA_LINGER_MS = 3_000;

type Delta = { value: number; expiresAt: number };
type DeltaMap = Record<string, Delta>; // key: `${uuid}:${field}`

const deltaKey = (uuid: string, field: NumericField) => `${uuid}:${field}`;

export function LeaderboardTable({
  rows: initial,
  isMock,
}: {
  rows: LeaderboardRow[];
  isMock: boolean;
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initial);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("normal_logs");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [paused, setPaused] = useState<boolean>(
    typeof document !== "undefined" ? document.hidden : false,
  );
  const [deltas, setDeltas] = useState<DeltaMap>({});

  const filterRef = useRef<HTMLInputElement>(null);
  const prevByUuid = useRef<Map<string, LeaderboardRow>>(
    new Map(initial.map((r) => [r.uuid, r])),
  );

  // ── Diff incoming rows vs previous, write delta entries ─────────────────────
  const applyRowsWithDeltas = useCallback((next: LeaderboardRow[]) => {
    const now = Date.now();
    const newDeltas: DeltaMap = {};
    for (const r of next) {
      const prev = prevByUuid.current.get(r.uuid);
      if (!prev) continue; // brand-new row — no delta
      (["normal_logs", "prestige_logs", "entries"] as NumericField[]).forEach((f) => {
        const diff = r[f] - prev[f];
        if (diff !== 0) {
          newDeltas[deltaKey(r.uuid, f)] = { value: diff, expiresAt: now + DELTA_LINGER_MS };
        }
      });
    }
    prevByUuid.current = new Map(next.map((r) => [r.uuid, r]));
    setRows(next);
    if (Object.keys(newDeltas).length > 0) {
      setDeltas((prev) => ({ ...prev, ...newDeltas }));
    }
  }, []);

  // ── Polling loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const next = await pollLeaderboardAction();
        if (cancelled) return;
        applyRowsWithDeltas(next);
      } catch {
        // swallow — next tick will retry
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [applyRowsWithDeltas]);

  // ── Visibility pause / resume ───────────────────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      const hidden = document.hidden;
      setPaused(hidden);
      // When coming back from hidden, kick an immediate poll
      if (!hidden) {
        pollLeaderboardAction()
          .then((next) => applyRowsWithDeltas(next))
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [applyRowsWithDeltas]);

  // ── Drop expired deltas on a short interval ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setDeltas((prev) => {
        const now = Date.now();
        let mutated = false;
        const next: DeltaMap = {};
        for (const [k, d] of Object.entries(prev)) {
          if (d.expiresAt > now) next[k] = d;
          else mutated = true;
        }
        return mutated ? next : prev;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── 'f' focuses filter ──────────────────────────────────────────────────────
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

  // ── Derived sorted/filtered list + rank map ─────────────────────────────────
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

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return sortedFull;
    return sortedFull.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.uuid.toLowerCase().startsWith(q),
    );
  }, [sortedFull, query]);

  // Any UUID with a live delta is "active" — gets the lime tint while moving
  const activeUuids = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(deltas)) set.add(key.split(":")[0]);
    return set;
  }, [deltas]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  // ── Dev preview: bump a random row's numbers so the animation + delta play ──
  const previewShuffle = () => {
    setRows((current) => {
      if (current.length < 4) return current;
      // pick a non-#1 row to avoid making it look like always-#1 just got bigger
      const idx = 1 + Math.floor(Math.random() * (current.length - 1));
      const bump = 1 + Math.floor(Math.random() * 12);
      const next = current.map((r, i) =>
        i === idx
          ? {
              ...r,
              normal_logs: r.normal_logs + bump,
              entries: r.entries + bump,
            }
          : r,
      );
      // Trigger delta tracking through the same code path
      queueMicrotask(() => applyRowsWithDeltas(next));
      return current;
    });
  };

  return (
    <div className="space-y-4 settle" style={{ animationDelay: "120ms" }}>
      {/* Filter + sort + live indicator */}
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
        <div className="ml-auto flex items-center gap-3">
          {isMock && (
            <button
              type="button"
              onClick={previewShuffle}
              className="inline-flex items-center gap-1.5 border border-[var(--color-rule-2)] bg-[var(--color-paper)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)] transition hover:border-[var(--color-lime)] hover:text-[var(--color-lime)]"
              title="Dev only — bump a random row to demo the animation"
            >
              <Zap className="h-3 w-3" />
              preview
            </button>
          )}
          <LiveIndicator paused={paused} />
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
          <div className="grid grid-cols-[64px_1fr_repeat(3,minmax(0,120px))] items-center gap-4 border-b border-dashed border-[var(--color-rule-2)] px-4 py-2.5">
            <span className="label-tiny">rank</span>
            <span className="label-tiny">player</span>
            <span className="label-tiny text-right">normal</span>
            <span className="label-tiny text-right">prestige</span>
            <span className="label-tiny text-right">entries</span>
          </div>
          <motion.ul layout>
            <AnimatePresence initial={false}>
              {filtered.map((r) => {
                const rank = rankByUuid.get(r.uuid) ?? 0;
                const podium = rank > 0 && rank <= 3;
                const isActive = activeUuids.has(r.uuid);
                const tone =
                  rank === 1
                    ? "var(--color-lime)"
                    : rank === 2
                      ? "var(--color-vellum)"
                      : rank === 3
                        ? "var(--color-amber)"
                        : "var(--color-fg-muted)";
                return (
                  <motion.li
                    key={r.uuid}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ layout: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }, opacity: { duration: 0.2 } }}
                  >
                    <Link
                      href={`/players/${r.uuid}` as Route}
                      className={
                        "grid grid-cols-[64px_1fr_repeat(3,minmax(0,120px))] items-center gap-4 border-b border-dashed border-[var(--color-rule)] px-4 py-3 text-sm transition-colors duration-500 last:border-b-0 " +
                        (isActive
                          ? "bg-[var(--color-lime)]/15 hover:bg-[var(--color-lime)]/25"
                          : "hover:bg-[var(--color-paper-2)]")
                      }
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
                      <NumCell
                        value={r.normal_logs}
                        highlight={sortKey === "normal_logs"}
                        delta={deltas[deltaKey(r.uuid, "normal_logs")]}
                      />
                      <NumCell
                        value={r.prestige_logs}
                        highlight={sortKey === "prestige_logs"}
                        delta={deltas[deltaKey(r.uuid, "prestige_logs")]}
                      />
                      <NumCell
                        value={r.entries}
                        highlight={sortKey === "entries"}
                        delta={deltas[deltaKey(r.uuid, "entries")]}
                        muted
                      />
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        </div>
      )}
    </div>
  );
}

function NumCell({
  value,
  highlight,
  muted,
  delta,
}: {
  value: number;
  highlight?: boolean;
  muted?: boolean;
  delta?: Delta;
}) {
  return (
    <span className="relative flex items-center justify-end gap-2 text-right">
      <AnimatePresence>
        {delta && (
          <motion.span
            key={delta.expiresAt}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 0 }}
            transition={{ duration: 0.25 }}
            className={
              "font-mono text-[10px] tabular-nums " +
              (delta.value > 0
                ? "text-[var(--color-lime)]"
                : "text-[var(--color-rust)]")
            }
          >
            {delta.value > 0 ? `+${delta.value}` : delta.value}
          </motion.span>
        )}
      </AnimatePresence>
      <span
        className={
          "font-mono tabular-nums " +
          (highlight
            ? "text-[var(--color-lime)]"
            : muted
              ? "text-[var(--color-fg-muted)]"
              : "text-[var(--color-fg)]")
        }
      >
        {value.toLocaleString()}
      </span>
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

function LiveIndicator({ paused }: { paused: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
      <span
        className={
          "inline-block h-1.5 w-1.5 " +
          (paused ? "bg-[var(--color-fg-dim)]" : "bg-[var(--color-lime)] shimmer")
        }
      />
      {paused ? "paused" : "live"}
    </span>
  );
}
