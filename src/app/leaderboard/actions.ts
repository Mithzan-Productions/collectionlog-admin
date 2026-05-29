"use server";

import { leaderboard } from "@/db/queries";

export async function pollLeaderboardAction() {
  return leaderboard(100);
}
