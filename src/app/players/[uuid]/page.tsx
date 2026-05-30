import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Hash, Sparkles } from "lucide-react";
import {
  getPlayer,
  isOnline,
  listCollectionsForPicker,
  listGrantedEntries,
  progressByCollection,
} from "@/db/queries";
import { Badge } from "@/components/ui/badge";
import { PlayerHead } from "@/components/player-head";
import { getAuthSession } from "@/auth";
import { GrantPanel } from "./grant-panel";
import { ProgressSection } from "./progress-section";

export const dynamic = "force-dynamic";

function formatTimestamp(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const holder = await getPlayer(uuid);
  if (!holder) notFound();

  const [progress, online, collections, granted, session] = await Promise.all([
    progressByCollection(uuid),
    isOnline(uuid),
    listCollectionsForPicker(),
    listGrantedEntries(uuid),
    getAuthSession(),
  ]);
  const isAdmin = Boolean(session?.user?.isAdmin);

  const totalGranted = progress.reduce((acc, r) => acc + Number(r.granted ?? 0), 0);
  const totalEntries = progress.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const overallPct = totalEntries === 0 ? 0 : Math.round((totalGranted / totalEntries) * 100);

  // For "last updated", surface the most recent `_ts` from entries (the holder
  // itself doesn't carry one). Falls back to em-dash for empty holders.
  const latest = (holder.entries ?? []).reduce<number>((m, e) => (e._ts > m ? e._ts : m), 0);
  const updatedIso = latest > 0 ? new Date(latest).toISOString() : undefined;

  return (
    <div className="space-y-6">
      <Link
        href="/players"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All players
      </Link>

      {/* Header card */}
      <div className="rounded border bg-[var(--color-panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <PlayerHead name={holder.name} size={48} />
              <div>
                <h1 className="text-xl font-semibold leading-tight">{holder.name}</h1>
                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-[var(--color-fg-muted)]">
                  <Hash className="h-3 w-3" />
                  <span>{uuid}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={online ? "success" : "default"}>
                {online ? "online" : "offline"}
              </Badge>
              <Badge variant="accent">
                {(holder.entries?.length ?? 0)} entries
              </Badge>
              <Badge variant="default" className="gap-1">
                <Clock className="h-3 w-3" />
                {updatedIso ? formatTimestamp(updatedIso) : "never updated"}
              </Badge>
            </div>
          </div>

          <div className="min-w-[12rem] space-y-1.5">
            <div className="flex items-end justify-between gap-3">
              <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                Overall
              </div>
              <div className="font-mono text-xs text-[var(--color-fg-muted)]">
                {totalGranted}/{totalEntries}
              </div>
            </div>
            <ProgressBar pct={overallPct} />
            <div className="text-right font-mono text-xs">
              <span
                className={
                  overallPct === 100
                    ? "text-[var(--color-accent-2)]"
                    : "text-[var(--color-accent)]"
                }
              >
                {overallPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          Progress
        </div>
        {progress.length === 0 ? (
          <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-8 text-center font-mono text-sm text-[var(--color-fg-muted)]">
            No collections found in the catalog.
          </div>
        ) : (
          <ProgressSection rows={progress} />
        )}
      </section>

      {/* Grant / revoke section. Heading + mutation panels render only for admins;
          non-admins still see the granted list inside GrantPanel for read-only inspection. */}
      <section className="space-y-3">
        {isAdmin && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[var(--color-accent-2)]" />
            Grant entries
          </div>
        )}
        <GrantPanel
          uuid={uuid}
          holder={holder}
          collections={collections}
          granted={granted}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
}

function ProgressBar({ pct, complete }: { pct: number; complete?: boolean }) {
  const color = complete ? "var(--color-lime)" : "var(--color-vellum)";
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="relative h-3 w-full overflow-hidden border border-[var(--color-rule-2)] bg-[var(--color-ink)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent 0 9px, var(--color-rule-2) 9px 10px)",
      }}
    >
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          backgroundColor: color,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 9px, rgba(13,12,10,0.45) 9px 10px)",
        }}
      />
    </div>
  );
}
