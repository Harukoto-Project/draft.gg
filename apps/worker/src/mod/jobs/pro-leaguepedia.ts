import { createChampionResolver, matchLeaguepediaDrafts } from "@draftgg/data-sources";
import type { LeaguepediaDraft, ProOrderFill } from "@draftgg/data-sources";
import type { ChampionRef, ProGameDraft } from "@draftgg/shared";
import { proMatchDate } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export interface LeaguepediaCredentials {
  username: string;
  password: string;
}

export interface ProLeaguepediaDeps {
  /** 無いときは何も取得せず成功にする */
  credentials: LeaguepediaCredentials | null;
  listChampions: () => Promise<ChampionRef[]>;
  listGames: () => Promise<ProGameDraft[]>;
  fetchDrafts: (since: string, signal?: AbortSignal) => Promise<LeaguepediaDraft[]>;
  fillOrders: (fills: ProOrderFill[]) => Promise<number>;
}

/**
 * Oracle's Elixir のあとに、ピックと BAN の順番が空の試合だけを補完する。
 * 認証情報が無いときはスキップする。スケジュールは持たず、pro-oracles から起動する。
 */
export function createProLeaguepediaJob(deps: ProLeaguepediaDeps): Job {
  return {
    name: "pro-leaguepedia",
    schedule: null,
    runOnStart: false,
    async run(signal) {
      if (!deps.credentials) return { skipped: true };
      const games = await deps.listGames();
      if (games.length === 0) return { skipped: true, reason: "no games" };
      const since = earliestSince(games);
      const drafts = await deps.fetchDrafts(since, signal);
      if (signal?.aborted) throw new Error("中断されました");
      const champions = await deps.listChampions();
      const resolve = createChampionResolver(champions);
      const matched = matchLeaguepediaDrafts(games, drafts, resolve);
      const updated = await deps.fillOrders(matched.fills);
      return {
        drafts: drafts.length,
        matched: matched.fills.length,
        updated,
        ambiguous: matched.ambiguous,
      };
    },
  };
}

function earliestSince(games: ProGameDraft[]): string {
  const earliest = games.map((game) => proMatchDate(game.playedAt)).sort()[0];
  if (!earliest) throw new Error("プロ試合がありません");
  return `${earliest} 00:00:00`;
}
