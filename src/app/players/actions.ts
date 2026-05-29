"use server";

import { listPlayers } from "@/db/queries";

/**
 * Wraps listPlayers for client-side debounced filtering.
 * No mutation, no revalidation — pure read.
 */
export async function searchPlayersAction(name: string) {
  return listPlayers(name);
}
