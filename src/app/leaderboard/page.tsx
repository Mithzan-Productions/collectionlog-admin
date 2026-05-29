import { Trophy } from "lucide-react";
import { leaderboard } from "@/db/queries";
import { LeaderboardTable } from "./leaderboard-table";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rows = await leaderboard(100);
  const totalNormal = rows.reduce((s, r) => s + r.normal_logs, 0);
  const totalPrestige = rows.reduce((s, r) => s + r.prestige_logs, 0);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="settle">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)]">
          <Trophy className="h-3 w-3" />
          <span>leaderboard</span>
          <span className="opacity-50">/</span>
          <span className="text-[var(--color-lime)]">rank</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <h1 className="display text-[clamp(40px,6vw,64px)] text-[var(--color-fg)]">
            COLLECTION<span className="text-[var(--color-lime)]">/</span>RANK
          </h1>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Stat label="ranked players" value={rows.length} />
            <Stat label="normal Σ" value={totalNormal} accent />
            <Stat label="prestige Σ" value={totalPrestige} />
          </dl>
        </div>
      </section>

      <hr className="punchline" />

      {rows.length === 0 ? (
        <div className="border border-dashed border-[var(--color-rule-2)] bg-[var(--color-paper)] px-4 py-10 text-center font-mono text-sm text-[var(--color-fg-muted)]">
          no ranked players yet.
        </div>
      ) : (
        <LeaderboardTable rows={rows} />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <dt className="label-tiny">{label}</dt>
      <dd
        className={
          "font-display text-[28px] leading-none tabular-nums tracking-tight " +
          (accent ? "text-[var(--color-lime)]" : "text-[var(--color-fg)]")
        }
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
