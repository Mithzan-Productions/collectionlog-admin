"use server";

import { revalidatePath } from "next/cache";
import {
  grantEntries,
  revokeEntries,
  entriesForGrantingCollection,
  searchEntries,
} from "@/db/queries";
import { publishHolderReload } from "@/lib/messagebus";

export type EntryKey = { identifier: string; collectionId: string };

export async function grantAction(uuid: string, entries: EntryKey[]) {
  const n = await grantEntries(uuid, entries);
  if (n > 0) await publishHolderReload(uuid);
  revalidatePath(`/players/${uuid}`);
  return { granted: n };
}

export async function revokeAction(uuid: string, entries: EntryKey[]) {
  const n = await revokeEntries(uuid, entries);
  if (n > 0) await publishHolderReload(uuid);
  revalidatePath(`/players/${uuid}`);
  return { revoked: n };
}

export async function grantCollectionAction(uuid: string, collectionId: string) {
  const entries = await entriesForGrantingCollection(collectionId);
  return grantAction(uuid, entries);
}

export async function revokeCollectionAction(uuid: string, collectionId: string) {
  // Pass every catalog entry — revoke_entries is a no-op for ones not on the holder.
  const entries = await entriesForGrantingCollection(collectionId);
  return revokeAction(uuid, entries);
}

export async function searchAction(q: string) {
  return searchEntries(q, 50);
}
