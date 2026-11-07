import { proMatchDate } from "@draftgg/shared";
import type { ProActionType, ProGameDraft } from "@draftgg/shared";

import { proMatchKey } from "../pro/names.js";

import { leaguepediaOrders } from "./client.js";
import type { LeaguepediaDraft } from "./client.js";

export interface ProOrderFill {
  gameKey: string;
  orders: Array<{ championId: string; type: ProActionType; order: number }>;
}

/**
 * 日付・チーム名・ゲーム番号で突き合わせる。
 * 同じキーが複数ある試合は更新しない。チャンピオン名を解決できない手は飛ばす。
 */
export function matchLeaguepediaDrafts(
  games: Array<Pick<ProGameDraft, "gameKey" | "playedAt" | "blueTeam" | "redTeam" | "gameNumber">>,
  drafts: LeaguepediaDraft[],
  resolve: (name: string) => string | null,
): { fills: ProOrderFill[]; ambiguous: number } {
  const byKey = new Map<string, string[]>();
  for (const game of games) {
    const key = proMatchKey(
      proMatchDate(game.playedAt),
      game.blueTeam,
      game.redTeam,
      game.gameNumber,
    );
    const ids = byKey.get(key) ?? [];
    ids.push(game.gameKey);
    byKey.set(key, ids);
  }

  const fills: ProOrderFill[] = [];
  let ambiguous = 0;
  for (const draft of drafts) {
    const ids = byKey.get(
      proMatchKey(draft.matchDate, draft.blueTeam, draft.redTeam, draft.gameNumber),
    );
    const gameKey = ids?.length === 1 ? ids[0] : undefined;
    if (!gameKey) {
      if (ids && ids.length > 1) ambiguous += 1;
      continue;
    }
    const orders = leaguepediaOrders(draft).flatMap((action) => {
      const championId = resolve(action.championName);
      if (!championId) return [];
      return [{ championId, type: action.type, order: action.order }];
    });
    if (orders.length > 0) fills.push({ gameKey, orders });
  }
  return { fills, ambiguous };
}
