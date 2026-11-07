import { POSITIONS } from "@draftgg/shared";

import { toOpggChampionKey } from "./names.js";
import { extractToolJson, parseChampionAnalysis, parseLaneMeta } from "./parse.js";
import type { OpggClient, OpggTransport } from "./types.js";

const LANE_META_FIELDS = POSITIONS.map(
  (position) =>
    `data.positions.${position}[].{champion,role_rate,tier,win_rate,pick_rate,ban_rate,play,rank}`,
);

const ANALYSIS_FIELDS = [
  "data.damage_type",
  "data.summary.id",
  // average_stats の試合数・勝率・ティアはチャンピオン全体の値。ロール別は positions[] から取る
  "data.summary.average_stats.ban_rate",
  "data.summary.positions[].{name,stats.{play,win_rate,pick_rate,role_rate},stats.tier_data.{tier,rank}}",
  "data.strong_counters[].{champion_id,my_win_rate,play}",
  "data.weak_counters[].{champion_id,my_win_rate,play}",
  "data.synergies",
];

export function createOpggClient(transport: OpggTransport): OpggClient {
  return {
    async listLaneMeta(catalog) {
      const result = await transport.callTool("lol_list_lane_meta_champions", {
        position: "all",
        lang: "en_US",
        desired_output_fields: LANE_META_FIELDS,
      });
      return parseLaneMeta(extractToolJson(result), catalog);
    },

    async analyzeChampion(catalog, target) {
      const result = await transport.callTool("lol_get_champion_analysis", {
        game_mode: "ranked",
        champion: toOpggChampionKey(target.nameEn),
        position: target.position,
        tier: "diamond_plus",
        lang: "en_US",
        desired_output_fields: ANALYSIS_FIELDS,
      });
      return parseChampionAnalysis(extractToolJson(result), catalog, target);
    },

    close: () => transport.close(),
  };
}
