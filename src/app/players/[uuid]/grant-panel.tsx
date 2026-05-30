"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ColoredText } from "@/components/colored-text";
import type { LogHolder } from "@/db/schema";
import type { GrantedEntryRow } from "@/db/queries";
import {
  grantAction,
  grantCollectionAction,
  revokeAction,
  revokeCollectionAction,
  searchAction,
  type EntryKey,
} from "./actions";

type SearchRow = Awaited<ReturnType<typeof searchAction>>[number];

type CollectionOption = {
  identifier: string;
  displayNamePlain: string;
  displayNameRaw: string | null;
};

type Toast = {
  kind: "success" | "error" | "info";
  message: string;
};

function keyOf(e: { identifier: string; collection_id?: string; collectionId?: string }) {
  const cid = "collection_id" in e && e.collection_id !== undefined ? e.collection_id : e.collectionId;
  return `${e.identifier}::${cid}`;
}

type ConfirmKind =
  | { type: "grant"; entries: EntryKey[]; label: string }
  | { type: "grantCollection"; collectionId: string; label: string }
  | { type: "revokeCollection"; collectionId: string; label: string }
  | { type: "revoke"; entries: EntryKey[]; label: string }
  | { type: "revokeBulk"; entries: EntryKey[]; label: string };

export function GrantPanel({
  uuid,
  holder,
  collections,
  granted,
  isAdmin,
}: {
  uuid: string;
  holder: LogHolder;
  collections: CollectionOption[];
  granted: GrantedEntryRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  // `query` here is the *debounced* query — only updates when SearchInput
  // commits, never on every keystroke. The input's typing state lives inside
  // SearchInput so it doesn't cause this parent to re-render.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  // Which query the current `results` were produced for. Prevents the "no
  // matches" flash on the first render after `query` becomes non-empty but
  // before the search has actually run.
  const [resultsFor, setResultsFor] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchPending, startSearch] = useTransition();
  const [mutationPending, startMutation] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [collectionId, setCollectionId] = useState<string>(collections[0]?.identifier ?? "");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set of currently granted (identifier, collectionId) tuples for badge labeling.
  const grantedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of holder.entries ?? []) s.add(`${e.identifier}::${e.collectionId}`);
    return s;
  }, [holder.entries]);

  // Fires only when the debounced query (not the live input) changes.
  // Request-id guards against a slow in-flight search overwriting newer results.
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setResultsFor("");
      return;
    }
    const myId = ++reqIdRef.current;
    startSearch(async () => {
      const rows = await searchAction(query);
      if (myId !== reqIdRef.current) return;
      setResults(rows);
      setResultsFor(query);
    });
  }, [query]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  // Stable callback so memoized ResultRow doesn't re-render on every keystroke
  const toggle = useCallback((k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelected(new Set(results.map((r) => keyOf(r))));
  };
  const clearSelection = () => setSelected(new Set());

  const selectedEntries: EntryKey[] = useMemo(
    () =>
      results
        .filter((r) => selected.has(keyOf(r)))
        .map((r) => ({ identifier: r.identifier, collectionId: r.collection_id })),
    [results, selected],
  );

  const askGrantSelected = () => {
    if (selectedEntries.length === 0) return;
    setConfirm({
      type: "grant",
      entries: selectedEntries,
      label: `${selectedEntries.length} entr${selectedEntries.length === 1 ? "y" : "ies"}`,
    });
  };

  const askRevokeSelected = () => {
    if (selectedEntries.length === 0) return;
    setConfirm({
      type: "revokeBulk",
      entries: selectedEntries,
      label: `${selectedEntries.length} entr${selectedEntries.length === 1 ? "y" : "ies"}`,
    });
  };

  const askGrantCollection = () => {
    if (!collectionId) return;
    const c = collections.find((c) => c.identifier === collectionId);
    setConfirm({
      type: "grantCollection",
      collectionId,
      label: c?.displayNamePlain ?? collectionId,
    });
  };

  const askRevokeCollection = () => {
    if (!collectionId) return;
    const c = collections.find((c) => c.identifier === collectionId);
    setConfirm({
      type: "revokeCollection",
      collectionId,
      label: c?.displayNamePlain ?? collectionId,
    });
  };

  const askRevoke = (row: GrantedEntryRow) => {
    setConfirm({
      type: "revoke",
      entries: [{ identifier: row.identifier, collectionId: row.collection_id }],
      label: row.display_name_plain ?? row.identifier,
    });
  };

  const runConfirmed = () => {
    if (!confirm) return;
    const c = confirm;
    startMutation(async () => {
      try {
        if (c.type === "grant") {
          const { granted } = await grantAction(uuid, c.entries);
          setToast(
            granted > 0
              ? { kind: "success", message: `Granted ${granted} entr${granted === 1 ? "y" : "ies"}.` }
              : { kind: "info", message: "Nothing granted — all entries were already on the holder." },
          );
          if (granted > 0) clearSelection();
        } else if (c.type === "grantCollection") {
          const { granted } = await grantCollectionAction(uuid, c.collectionId);
          setToast(
            granted > 0
              ? {
                  kind: "success",
                  message: `Granted ${granted} entr${granted === 1 ? "y" : "ies"} from ${c.label}.`,
                }
              : { kind: "info", message: `${c.label} was already complete for this player.` },
          );
        } else if (c.type === "revokeCollection") {
          const { revoked } = await revokeCollectionAction(uuid, c.collectionId);
          setToast(
            revoked > 0
              ? {
                  kind: "success",
                  message: `Revoked ${revoked} entr${revoked === 1 ? "y" : "ies"} from ${c.label}.`,
                }
              : { kind: "info", message: `Nothing to revoke from ${c.label}.` },
          );
        } else if (c.type === "revokeBulk") {
          const { revoked } = await revokeAction(uuid, c.entries);
          setToast(
            revoked > 0
              ? { kind: "success", message: `Revoked ${revoked} entr${revoked === 1 ? "y" : "ies"}.` }
              : { kind: "info", message: "Nothing to revoke — none of the selected entries were on the holder." },
          );
          if (revoked > 0) clearSelection();
        } else if (c.type === "revoke") {
          const { revoked } = await revokeAction(uuid, c.entries);
          setToast(
            revoked > 0
              ? { kind: "success", message: `Revoked ${revoked} entr${revoked === 1 ? "y" : "ies"}.` }
              : { kind: "info", message: "Nothing to revoke — entry already gone." },
          );
        }
        router.refresh();
      } catch (err) {
        setToast({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setConfirm(null);
      }
    });
  };

  return (
    <div className="relative space-y-5">
      {toast && (
        <div
          role="status"
          className={
            "rounded border px-4 py-3 text-sm " +
            (toast.kind === "success"
              ? "border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)]"
              : toast.kind === "error"
                ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                : "border-[var(--color-border)] bg-[var(--color-panel-2)] text-[var(--color-fg-muted)]")
          }
        >
          {toast.message}
        </div>
      )}

      {/* Search box — admin only */}
      {isAdmin && (
      <div className="space-y-3 rounded border bg-[var(--color-panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Search & grant entries</div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            {selected.size > 0 && (
              <span className="font-mono text-[var(--color-accent)]">{selected.size} selected</span>
            )}
          </div>
        </div>

        <SearchInput onCommit={setQuery} pending={searchPending} />

        {results.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 gap-1.5 px-2">
                <CheckCheck className="h-3.5 w-3.5" /> Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 gap-1.5 px-2">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
            <div className="text-[var(--color-fg-muted)]">
              {results.length} result{results.length === 1 ? "" : "s"}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-80 divide-y divide-[var(--color-border)]/60 overflow-y-auto rounded border bg-[var(--color-bg)]">
            {results.map((r) => {
              const k = keyOf(r);
              const already = grantedKeys.has(`${r.identifier}::${r.collection_id}`);
              const checked = selected.has(k);
              return (
                <ResultRow
                  key={k}
                  row={r}
                  rowKey={k}
                  checked={checked}
                  already={already}
                  onToggle={toggle}
                />
              );
            })}
          </div>
        )}

        {query.trim() && resultsFor === query && results.length === 0 && !searchPending && (
          <div className="rounded border border-dashed bg-[var(--color-bg)] px-4 py-6 text-center text-xs text-[var(--color-fg-muted)]">
            No catalog matches for <span className="font-mono">{query}</span>.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="danger"
            disabled={selectedEntries.length === 0 || mutationPending}
            onClick={askRevokeSelected}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Revoke selected
          </Button>
          <Button
            disabled={selectedEntries.length === 0 || mutationPending}
            onClick={askGrantSelected}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Grant selected
          </Button>
        </div>
      </div>
      )}

      {/* Grant / revoke entire collection — admin only */}
      {isAdmin && (
      <div className="space-y-3 border border-[var(--color-rule-2)] bg-[var(--color-paper)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-[var(--color-fg-muted)]" />
          Whole collection
        </div>
        <CollectionCombobox
          collections={collections}
          value={collectionId}
          onChange={setCollectionId}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="danger"
            disabled={!collectionId || mutationPending}
            onClick={askRevokeCollection}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            Revoke collection
          </Button>
          <Button
            variant="secondary"
            disabled={!collectionId || mutationPending}
            onClick={askGrantCollection}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Grant collection
          </Button>
        </div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-dim)]">
          Both operations are dedup-safe — only what needs to change does.
        </p>
      </div>
      )}

      {/* Granted list — revoke buttons admin-only */}
      <div className="rounded border bg-[var(--color-panel)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-medium">
            Granted entries
            <span className="ml-2 font-mono text-xs text-[var(--color-fg-muted)]">
              ({granted.length})
            </span>
          </div>
        </div>
        {granted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            No granted entries yet.
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-[var(--color-border)]/60 overflow-y-auto">
            {granted.map((g) => (
              <li
                key={`${g.identifier}::${g.collection_id}`}
                className="group flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-panel-2)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    <ColoredText
                      raw={g.display_name_raw}
                      fallback={g.display_name_plain ?? g.identifier}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                    <ColoredText
                      raw={g.collection_display_raw}
                      fallback={g.collection_display_plain ?? g.collection_id}
                    />
                    <span className="opacity-40">·</span>
                    <span className="truncate font-mono">{g.identifier}</span>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="gap-1.5 opacity-70 transition-opacity group-hover:opacity-100"
                    disabled={mutationPending}
                    onClick={() => askRevoke(g)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !mutationPending && setConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded border bg-[var(--color-panel)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {(() => {
              const isRevoke =
                confirm.type === "revoke" ||
                confirm.type === "revokeBulk" ||
                confirm.type === "revokeCollection";
              return (
                <>
                  <h2 className="mb-1 text-base font-semibold">
                    {isRevoke ? "Confirm revoke" : "Confirm grant"}
                  </h2>
                  <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
                    {confirm.type === "grant" && (
                      <>
                        About to grant <span className="font-mono text-[var(--color-fg)]">{confirm.label}</span> to{" "}
                        <span className="font-medium text-[var(--color-fg)]">{holder.name}</span>. Continue?
                      </>
                    )}
                    {confirm.type === "grantCollection" && (
                      <>
                        About to grant every entry in <span className="font-medium text-[var(--color-fg)]">{confirm.label}</span>{" "}
                        to <span className="font-medium text-[var(--color-fg)]">{holder.name}</span>. Continue?
                      </>
                    )}
                    {confirm.type === "revokeCollection" && (
                      <>
                        About to revoke every entry in <span className="font-medium text-[var(--color-fg)]">{confirm.label}</span>{" "}
                        from <span className="font-medium text-[var(--color-fg)]">{holder.name}</span>. Continue?
                      </>
                    )}
                    {confirm.type === "revokeBulk" && (
                      <>
                        About to revoke <span className="font-mono text-[var(--color-fg)]">{confirm.label}</span> from{" "}
                        <span className="font-medium text-[var(--color-fg)]">{holder.name}</span>. Entries not actually on the holder will be skipped. Continue?
                      </>
                    )}
                    {confirm.type === "revoke" && (
                      <>
                        About to revoke <span className="font-medium text-[var(--color-fg)]">{confirm.label}</span> from{" "}
                        <span className="font-medium text-[var(--color-fg)]">{holder.name}</span>. Continue?
                      </>
                    )}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={mutationPending}
                      onClick={() => setConfirm(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={isRevoke ? "danger" : "default"}
                      disabled={mutationPending}
                      onClick={runConfirmed}
                      className="gap-1.5"
                    >
                      {mutationPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isRevoke ? "Revoke" : "Grant"}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fuzzy combobox for picking a collection (scales to hundreds) ────────────
function CollectionCombobox({
  collections,
  value,
  onChange,
}: {
  collections: CollectionOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = collections.find((c) => c.identifier === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return collections;
    return collections.filter(
      (c) =>
        c.displayNamePlain.toLowerCase().includes(q) ||
        c.identifier.toLowerCase().includes(q),
    );
  }, [collections, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const commit = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-full items-center justify-between border border-[var(--color-rule-2)] bg-[var(--color-ink)] px-3 text-left font-mono text-sm transition hover:border-[var(--color-lime)]/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="label-tiny text-[var(--color-lime-dim)]">/</span>
            {current ? (
              <span className="min-w-0 truncate">
                <ColoredText raw={current.displayNameRaw} fallback={current.displayNamePlain} />
              </span>
            ) : (
              <span className="text-[var(--color-fg-dim)]">pick a collection…</span>
            )}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            {collections.length} ▾
          </span>
        </button>
      ) : (
        <div className="border border-[var(--color-lime)]/50 bg-[var(--color-ink)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-dim)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const c = filtered[activeIdx];
                  if (c) commit(c.identifier);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  setQuery("");
                }
              }}
              placeholder="search collections…"
              className="h-10 w-full border-b border-dashed border-[var(--color-rule-2)] bg-transparent pl-9 pr-3 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center font-mono text-xs text-[var(--color-fg-dim)]">
                no match for{" "}
                <span className="text-[var(--color-fg-muted)]">{query}</span>
              </div>
            ) : (
              filtered.map((c, i) => {
                const isActive = i === activeIdx;
                const isCurrent = c.identifier === value;
                return (
                  <button
                    key={c.identifier}
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => commit(c.identifier)}
                    className={
                      "flex w-full items-center gap-3 border-b border-dashed border-[var(--color-rule)] px-3 py-2 text-left text-sm last:border-b-0 " +
                      (isActive ? "bg-[var(--color-paper-2)]" : "")
                    }
                  >
                    <span
                      className={
                        "glyph font-mono text-xs " +
                        (isCurrent
                          ? "text-[var(--color-lime)]"
                          : isActive
                            ? "text-[var(--color-fg-muted)]"
                            : "text-[var(--color-fg-dim)]")
                      }
                    >
                      {isCurrent ? "[*]" : isActive ? "[›]" : "[ ]"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <ColoredText raw={c.displayNameRaw} fallback={c.displayNamePlain} />
                    </span>
                    <span className="hidden truncate font-mono text-[10px] text-[var(--color-fg-dim)] sm:inline">
                      {c.identifier}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-[var(--color-rule-2)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
            <span>{filtered.length} of {collections.length}</span>
            <span>↑↓ navigate · ↵ select · esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Isolated search input ───────────────────────────────────────────────────
// Owns its own typing state so keystrokes don't re-render the parent GrantPanel
// (which has a heavy result list, granted list, modals, etc.). Only commits the
// debounced value upward, eliminating the per-keystroke cascade.
const SearchInput = memo(function SearchInput({
  onCommit,
  pending,
  debounceMs = 300,
}: {
  onCommit: (q: string) => void;
  pending: boolean;
  debounceMs?: number;
}) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onCommit(value);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onCommit, debounceMs]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type to search the catalog (e.g. “halo”, “reaper”)…"
        className="pl-9"
      />
      {pending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-fg-muted)]" />
      )}
    </div>
  );
});

// ─── Memoized search result row (so keystrokes don't re-render the list) ─────
const ResultRow = memo(function ResultRow({
  row,
  rowKey,
  checked,
  already,
  onToggle,
}: {
  row: SearchRow;
  rowKey: string;
  checked: boolean;
  already: boolean;
  onToggle: (k: string) => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors " +
        (checked ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-panel-2)]")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(rowKey)}
        className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          <ColoredText raw={row.display_name_raw} fallback={row.display_name_plain} />
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <span className="truncate">{row.collection_id}</span>
          <span className="opacity-40">·</span>
          <span className="truncate font-mono">{row.identifier}</span>
        </div>
      </div>
      {already && (
        <Badge variant="success" className="shrink-0 gap-1">
          <Check className="h-3 w-3" />
          granted
        </Badge>
      )}
    </label>
  );
});
