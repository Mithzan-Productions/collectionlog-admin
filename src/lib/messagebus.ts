/**
 * MessageBus publish helper. Mirrors the envelope shape from docs/MESSAGING.md.
 *
 * In production: publish to Redis (TODO once the on-prem URL is wired up).
 * In dev/PGlite: log + insert into `dev_messagebus_log` so the UI can show
 * what would have been sent.
 */
import { rawQuery } from "@/db/client";

export type Envelope<T> = {
  type: string;
  version: number;
  timestamp: number;
  source: string;
  payload: T;
};

export type HolderReloadPayload = { uuid: string };

const SOURCE = "collectionlog-admin";

export async function publish<T>(channel: string, type: string, payload: T, version = 1): Promise<void> {
  const env: Envelope<T> = {
    type,
    version,
    timestamp: Date.now(),
    source: SOURCE,
    payload,
  };

  if (process.env.REDIS_URL) {
    // Real Redis publish goes here. Out of scope for the mock build.
    console.log("[messagebus] would publish to", channel, env);
    return;
  }

  // Dev shim: write to the dev log table
  await rawQuery(
    `INSERT INTO dev_messagebus_log(channel, type, payload) VALUES ($1, $2, $3::jsonb)`,
    [channel, type, JSON.stringify(env)],
  );
  console.log(`[messagebus:dev] ${channel} ${type}`, payload);
}

export const channels = {
  holderReload: "mcplus.collectionlog.holder.reload",
  catalogReload: "mcplus.collectionlog.catalog.reload",
};

export async function publishHolderReload(uuid: string) {
  return publish<HolderReloadPayload>(channels.holderReload, "holder.reload", { uuid });
}
