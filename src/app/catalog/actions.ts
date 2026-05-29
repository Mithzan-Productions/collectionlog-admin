"use server";

import { searchEntries, listCollections } from "@/db/queries";

export type SearchResult = {
  identifier: string;
  collection_id: string;
  display_name_plain: string;
  display_name_raw: string | null;
  material: string | null;
  score: number;
  collectionName: string;
  collectionRaw: string | null;
};

export async function searchAction(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const [entries, collections] = await Promise.all([
    searchEntries(q, 50),
    listCollections(),
  ]);
  const byId = new Map(collections.map((c) => [c.identifier, c]));
  return entries.map((e) => ({
    ...e,
    collectionName: byId.get(e.collection_id)?.displayNamePlain ?? e.collection_id,
    collectionRaw: byId.get(e.collection_id)?.displayNameRaw ?? null,
  }));
}
