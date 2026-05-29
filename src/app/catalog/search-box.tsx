"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, X, CornerDownLeft } from "lucide-react";
import { ColoredText } from "@/components/colored-text";
import { Badge } from "@/components/ui/badge";
import { searchAction, type SearchResult } from "./actions";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  // "/" focuses the input — small power-user touch.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounce 150ms; ignore out-of-order responses.
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const myId = ++reqIdRef.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchAction(q);
        if (reqIdRef.current === myId) setResults(rows);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const hasQuery = q.trim().length > 0;
  const showResults = hasQuery && results !== null;

  return (
    <div className="space-y-3">
      <div
        className="group relative flex items-center gap-3 rounded border bg-[var(--color-panel)] px-4 py-3 transition focus-within:border-[var(--color-accent)]/60 focus-within:bg-[var(--color-panel-2)]"
      >
        <Search
          className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)] transition group-focus-within:text-[var(--color-accent)]"
          aria-hidden
        />
        <span className="font-mono text-xs text-[var(--color-fg-muted)] select-none">
          search&nbsp;~&nbsp;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="halo, reaper, diamond..."
          aria-label="Search catalog entries"
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-muted)]/60"
        />
        <span
          className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] sm:flex"
          aria-hidden
        >
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5">
            /
          </kbd>
          <span>to focus</span>
        </span>
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="rounded p-1 text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="rounded border bg-[var(--color-panel)]">
          <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
            <span>
              {isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[var(--color-accent)]" />
                  searching
                </span>
              ) : (
                <>
                  {results.length} {results.length === 1 ? "match" : "matches"}
                </>
              )}
            </span>
            <span className="opacity-60">q = &quot;{q}&quot;</span>
          </div>

          {results.length === 0 && !isPending ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-[var(--color-fg-muted)]">
              no entries matched.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {results.map((r) => (
                <li key={`${r.collection_id}:${r.identifier}`}>
                  <Link
                    href={`/catalog/${r.collection_id}` as Route}
                    className="group flex items-center gap-4 px-4 py-2.5 transition hover:bg-[var(--color-panel-2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <ColoredText
                          raw={r.display_name_raw}
                          fallback={r.display_name_plain}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-[var(--color-fg-muted)]">
                        <span className="truncate">
                          in{" "}
                          <ColoredText
                            raw={r.collectionRaw}
                            fallback={r.collectionName}
                          />
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="truncate opacity-70">{r.identifier}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.material && (
                        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] md:inline">
                          {r.material}
                        </span>
                      )}
                      {r.score < 1.0 && (
                        <Badge variant="warn" className="font-mono">
                          ~{r.score.toFixed(2)}
                        </Badge>
                      )}
                      <CornerDownLeft className="h-3.5 w-3.5 text-[var(--color-fg-muted)] opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
