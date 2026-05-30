"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlayerHead } from "@/components/player-head";
import { searchPlayersAction } from "./actions";
import type { PlayerListRow } from "@/db/queries";

function shortUuid(uuid: string) {
  return uuid.slice(0, 8);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const GRID_COLS = "grid-cols-[1fr_120px_100px_140px]";

export function PlayerSearch({ initial }: { initial: PlayerListRow[] }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PlayerListRow[]>(initial);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await searchPlayersAction(query);
        setRows(result);
      });
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter players by name…"
          className="pl-9"
        />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-fg-muted)]" />
        )}
      </div>

      <div className="border border-[var(--color-rule-2)] bg-[var(--color-paper)]">
        <div
          className={`grid ${GRID_COLS} items-center gap-4 border-b border-dashed border-[var(--color-rule-2)] px-4 py-2.5`}
        >
          <span className="label-tiny">name</span>
          <span className="label-tiny">uuid</span>
          <span className="label-tiny text-right">entries</span>
          <span className="label-tiny text-right">updated</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            {query.trim() ? (
              <>No players match <span className="font-mono">{query}</span>.</>
            ) : (
              <>No players found.</>
            )}
          </div>
        ) : (
          <ul>
            {rows.map((p) => {
              const empty = p.entry_count === 0;
              return (
                <li key={p.uuid}>
                  <Link
                    href={`/players/${p.uuid}` as Route}
                    className={`grid ${GRID_COLS} items-center gap-4 border-b border-dashed border-[var(--color-rule)] px-4 py-3 text-sm transition last:border-b-0 hover:bg-[var(--color-paper-2)]`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <PlayerHead name={p.name} size={28} />
                      <span className="min-w-0 truncate font-medium text-[var(--color-fg)]">
                        {p.name ?? "(unnamed)"}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {shortUuid(p.uuid)}
                      <span className="opacity-40">…</span>
                    </span>
                    <span className="text-right">
                      {empty ? (
                        <Badge variant="default" className="text-[10px]">empty</Badge>
                      ) : (
                        <span className="font-mono text-xs text-[var(--color-fg)]">{p.entry_count}</span>
                      )}
                    </span>
                    <span className="text-right font-mono text-xs text-[var(--color-fg-muted)]">
                      {relativeTime(p.updated_at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="text-xs text-[var(--color-fg-muted)]">
        Showing <span className="font-mono text-[var(--color-fg)]">{rows.length}</span> player{rows.length === 1 ? "" : "s"}
        {query.trim() && (
          <>
            {" "}for filter <span className="font-mono text-[var(--color-accent)]">{query}</span>
          </>
        )}.
      </div>
    </div>
  );
}
