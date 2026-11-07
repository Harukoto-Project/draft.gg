import { MIN_CHAMPIONS } from "@draftgg/db";
import type { OraclesParseResult } from "@draftgg/data-sources";
import type { ChampionRef, ProGameDraft } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export const PRO_ORACLES_SCHEDULE = "0 3 * * *";

/** 解釈に失敗した試合がこの割合を超えたら、保存せず失敗にする */
const MAX_FAILURE_RATE = 0.1;
const MIN_GAMES_FOR_FAILURE_RATE = 20;

export interface ProOraclesDeps {
  listChampions: () => Promise<ChampionRef[]>;
  fetchGames: (champions: ChampionRef[], signal?: AbortSignal) => Promise<OraclesParseResult>;
  save: (games: ProGameDraft[]) => Promise<void>;
  /** 保存できたあと。Leaguepedia と集計を続ける */
  onImported?: () => void;
}

/**
 * 毎日 03:00 に当年の CSV を取り、対象リーグの完了試合を保存する。
 * 起動のたびに実行しない。保存後に onImported で後続ジョブを続ける。
 */
export function createProOraclesJob(deps: ProOraclesDeps): Job {
  return {
    name: "pro-oracles",
    schedule: PRO_ORACLES_SCHEDULE,
    runOnStart: false,
    async run(signal) {
      const champions = await deps.listChampions();
      if (champions.length < MIN_CHAMPIONS) {
        throw new Error(
          `チャンピオン数が ${champions.length} 件で、最低件数(${MIN_CHAMPIONS})を下回るため、プロ試合を保存しません`,
        );
      }
      const parsed = await deps.fetchGames(champions, signal);
      if (signal?.aborted) throw new Error("中断されました");
      assertParseQuality(parsed);
      await deps.save(parsed.games);
      deps.onImported?.();
      return {
        games: parsed.games.length,
        incomplete: parsed.skipped.incomplete,
        invalid: parsed.skipped.invalid,
        unmapped: parsed.skipped.unmapped,
        unmappedChampions: parsed.unmappedChampions,
      };
    },
  };
}

function assertParseQuality(parsed: OraclesParseResult): void {
  const failed = parsed.skipped.invalid + parsed.skipped.unmapped;
  const seen = parsed.games.length + failed;
  if (seen < MIN_GAMES_FOR_FAILURE_RATE) return;
  if (failed / seen > MAX_FAILURE_RATE) {
    throw new Error(`プロ試合の ${failed}/${seen} 件を解釈できなかったため、保存しません`);
  }
}
