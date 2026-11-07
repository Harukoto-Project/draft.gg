import { aggregateProStats } from "@draftgg/data-sources";
import type { ProChampionStatRow, ProGameDraft } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export interface ProAggregateDeps {
  listGames: () => Promise<ProGameDraft[]>;
  save: (rows: ProChampionStatRow[]) => Promise<void>;
  now?: () => Date;
}

/**
 * 保存済みのプロ試合から pro_champion_stats を作り直す。
 * 20 件以上のパッチが無いときは保存関数が失敗し、前回の統計が残る。
 * スケジュールは持たず、pro-oracles のあと(Leaguepedia の成否に関わらず)に起動する。
 */
export function createProAggregateJob(deps: ProAggregateDeps): Job {
  return {
    name: "pro-aggregate",
    schedule: null,
    runOnStart: false,
    async run() {
      const games = await deps.listGames();
      const rows = aggregateProStats(games, (deps.now ?? (() => new Date()))());
      if (rows.length === 0) {
        throw new Error("集計できるプロ試合が足りないため、前回の統計を残します");
      }
      await deps.save(rows);
      return { games: games.length, rows: rows.length };
    },
  };
}
