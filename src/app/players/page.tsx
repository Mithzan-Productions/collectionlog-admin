import { listPlayers } from "@/db/queries";
import { PlayerSearch } from "./player-search";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await listPlayers();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)]">/players</div>
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Pick a player to inspect their collection progress, or grant and revoke entries.
        </p>
      </header>

      <PlayerSearch initial={players} />
    </div>
  );
}
