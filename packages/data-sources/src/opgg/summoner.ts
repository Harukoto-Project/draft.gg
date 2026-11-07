import { z } from "zod";

import type { SummonerPoolEntry } from "./types.js";

const championStatSchema = z.object({
  id: z.number().int(),
  play: z.number().finite().nonnegative(),
  win: z.number().finite().nonnegative().optional(),
});

/**
 * ランクのよく使うチャンピオン(今シーズン)。新規アカウントでは null になる。
 * ロールの情報は含まれない。
 */
const summonerSchema = z.object({
  data: z.object({
    summoner: z.object({
      ranked_most_champions: z
        .object({ my_champion_stats: z.array(championStatSchema).nullable().optional() })
        .nullable()
        .optional(),
    }),
  }),
});

/** `lol_get_summoner_profile` の応答から、使用回数の多いチャンピオンを取り出す */
export function parseSummonerPool(payload: unknown): SummonerPoolEntry[] {
  const parsed = summonerSchema.parse(payload);
  const stats = parsed.data.summoner.ranked_most_champions?.my_champion_stats ?? [];

  const totals = new Map<number, { games: number; wins: number }>();
  for (const stat of stats) {
    const games = Math.round(stat.play);
    if (games <= 0) continue;
    const current = totals.get(stat.id) ?? { games: 0, wins: 0 };
    totals.set(stat.id, {
      games: current.games + games,
      wins: current.wins + Math.min(games, Math.round(stat.win ?? 0)),
    });
  }
  return [...totals]
    .map(([numericKey, total]) => ({
      numericKey,
      games: total.games,
      winRate: total.wins / total.games,
    }))
    .sort((a, b) => b.games - a.games);
}
