"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ColoredText } from "@/components/colored-text";
import type { ProgressRow } from "@/db/queries";

type Status = "complete" | "progress" | "untouched";

function statusOf(r: ProgressRow): Status {
  if (r.total === 0) return "untouched";
  if (r.granted >= r.total) return "complete";
  if (r.granted > 0) return "progress";
  return "untouched";
}

const STATUS_META: Record<Status, { label: string; glyph: string; tone: string }> = {
  progress: { label: "in progress", glyph: "[~]", tone: "var(--color-lime)" },
  complete: { label: "complete", glyph: "[*]", tone: "var(--color-vellum)" },
  untouched: { label: "untouched", glyph: "[ ]", tone: "var(--color-fg-dim)" },
};

export function ProgressSection({ rows }: { rows: ProgressRow[] }) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<Status, boolean>>({
    progress: true,
    complete: false,
    untouched: false,
  });
  const filterRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.display_name_plain.toLowerCase().includes(q) ||
        r.collection_id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const grouped = useMemo(() => {
    const out: Record<Status, ProgressRow[]> = { progress: [], complete: [], untouched: [] };
    for (const r of filtered) out[statusOf(r)].push(r);
    out.progress.sort((a, b) => b.granted / Math.max(1, b.total) - a.granted / Math.max(1, a.total));
    return out;
  }, [filtered]);

  // 'f' focuses the name filter (when not already in an input)
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

  const total = filtered.length;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-dim)]" />
          <Input
            ref={filterRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter collections — press f"
            className="h-9 pl-8 text-xs"
          />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
          <span className="text-[var(--color-fg-muted)]">{total}</span> of{" "}
          <span className="text-[var(--color-fg-muted)]">{rows.length}</span>
          {query && (
            <>
              {" "}· q: <span className="text-[var(--color-lime)]">{query}</span>
            </>
          )}
        </div>
      </div>

      {/* Status groups */}
      {total === 0 ? (
        <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-10 text-center font-mono text-xs text-[var(--color-fg-muted)]">
          [ no_matches ]
        </div>
      ) : (
        (["progress", "complete", "untouched"] as Status[]).map((s) => {
          if (grouped[s].length === 0) return null;
          const open = openGroups[s];
          const meta = STATUS_META[s];
          return (
            <div key={s} className="border border-[var(--color-rule-2)] bg-[var(--color-paper)]">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [s]: !prev[s] }))
                }
                className="flex w-full items-center gap-3 border-b border-dashed border-[var(--color-rule-2)] px-4 py-2.5 text-left transition hover:bg-[var(--color-paper-2)]"
              >
                <ChevronRight
                  className="h-3.5 w-3.5 text-[var(--color-fg-dim)] transition-transform"
                  style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                />
                <span className="glyph font-mono text-xs" style={{ color: meta.tone }}>
                  {meta.glyph}
                </span>
                <span className="label-tiny" style={{ color: meta.tone }}>
                  {meta.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[var(--color-fg-dim)]">
                  {grouped[s].length}
                </span>
              </button>
              {open && (
                <ul>
                  {grouped[s].map((r) => (
                    <ProgressRowView key={r.collection_id} row={r} />
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ProgressRowView({ row }: { row: ProgressRow }) {
  const granted = Number(row.granted ?? 0);
  const total = Number(row.total ?? 0);
  const pct = total === 0 ? 0 : Math.round((granted / total) * 100);
  const complete = total > 0 && granted >= total;
  const tone = complete ? "var(--color-lime)" : granted > 0 ? "var(--color-vellum)" : "var(--color-fg-dim)";

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-[var(--color-rule)] px-4 py-2.5 last:border-b-0 hover:bg-[var(--color-paper-2)]">
      <div className="min-w-0 space-y-1">
        <div className="truncate text-sm">
          <ColoredText raw={row.display_name_raw} fallback={row.display_name_plain} />
          {row.type && (
            <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
              {row.type}
            </span>
          )}
        </div>
        <Bar pct={pct} tone={tone} />
      </div>
      <div className="text-right">
        <div className="font-mono text-[10px] text-[var(--color-fg-dim)]">
          {granted}/{total}
        </div>
        <div className="font-mono text-xs tabular-nums" style={{ color: tone }}>
          {pct}%
        </div>
      </div>
    </li>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="relative h-2 w-full overflow-hidden border border-[var(--color-rule-2)] bg-[var(--color-ink)]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent 0 7px, var(--color-rule-2) 7px 8px)",
      }}
    >
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          backgroundColor: tone,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 7px, rgba(13,12,10,0.45) 7px 8px)",
        }}
      />
    </div>
  );
}
