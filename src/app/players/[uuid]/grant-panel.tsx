"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  | { type: "revoke"; entries: EntryKey[]; label: string };

export function GrantPanel({
  uuid,
  holder,
  collections,
  granted,
}: {
  uuid: string;
  holder: LogHolder;
  collections: CollectionOption[];
  granted: GrantedEntryRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchPending, startSearch] = useTransition();
  const [mutationPending, startMutation] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [collectionId, setCollectionId] = useState<string>(collections[0]?.identifier ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set of currently granted (identifier, collectionId) tuples for badge labeling.
  const grantedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of holder.entries ?? []) s.add(`${e.identifier}::${e.collectionId}`);
    return s;
  }, [holder.entries]);

  // Debounced fuzzy search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchAction(query);
        setResults(rows);
      });
    }, 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
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

  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

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

  const askGrantCollection = () => {
    if (!collectionId) return;
    const c = collections.find((c) => c.identifier === collectionId);
    setConfirm({
      type: "grantCollection",
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

      {/* Search box */}
      <div className="space-y-3 rounded border bg-[var(--color-panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Search & grant entries</div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            {selected.size > 0 && (
              <span className="font-mono text-[var(--color-accent)]">{selected.size} selected</span>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search the catalog (e.g. “halo”, “reaper”)…"
            className="pl-9"
          />
          {searchPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-fg-muted)]" />
          )}
        </div>

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
                <label
                  key={k}
                  className={
                    "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors " +
                    (checked ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-panel-2)]")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(k)}
                    className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      <ColoredText raw={r.display_name_raw} fallback={r.display_name_plain} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                      <span className="truncate">{r.collection_id}</span>
                      <span className="opacity-40">·</span>
                      <span className="truncate font-mono">{r.identifier}</span>
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
            })}
          </div>
        )}

        {query.trim() && results.length === 0 && !searchPending && (
          <div className="rounded border border-dashed bg-[var(--color-bg)] px-4 py-6 text-center text-xs text-[var(--color-fg-muted)]">
            No catalog matches for <span className="font-mono">{query}</span>.
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
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

      {/* Grant entire collection */}
      <div className="space-y-3 rounded border bg-[var(--color-panel)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-[var(--color-fg-muted)]" />
          Grant entire collection
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="h-9 flex-1 rounded border bg-[var(--color-panel-2)] px-3 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {collections.map((c) => (
              <option key={c.identifier} value={c.identifier}>
                {c.displayNamePlain} ({c.identifier})
              </option>
            ))}
          </select>
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
        <p className="text-xs text-[var(--color-fg-muted)]">
          Dedup-safe — already granted entries are skipped on the DB side.
        </p>
      </div>

      {/* Granted list with revoke */}
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
            <h2 className="mb-1 text-base font-semibold">
              {confirm.type === "revoke" ? "Revoke entry?" : "Confirm grant"}
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
                variant={confirm.type === "revoke" ? "danger" : "default"}
                disabled={mutationPending}
                onClick={runConfirmed}
                className="gap-1.5"
              >
                {mutationPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirm.type === "revoke" ? "Revoke" : "Grant"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
