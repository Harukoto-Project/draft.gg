import { createOpggClient } from "@draftgg/data-sources";
import type { LaneMetaRow, OpggTransport } from "@draftgg/data-sources";
import { DEFAULT_RANK_TIER } from "@draftgg/shared";
import type { ChampionRef } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export const OPGG_META_SCHEDULE = "0 0,6,12,18 * * *";

export interface OpggMetaDeps {
  connect: () => Promise<OpggTransport>;
  listChampions: () => Promise<ChampionRef[]>;
  getCurrentPatch: () => Promise<string | null>;
  save: (input: {
    patch: string;
    tier: typeof DEFAULT_RANK_TIER;
    rows: LaneMetaRow[];
  }) => Promise<void>;
}

/**
 * 6時間ごとにロール別のメタ一覧を1回取る。
 * 起動のたびに呼ばない。新しいパッチを ddragon が保存したときだけ前倒しする。
 */
export function createOpggMetaJob(deps: OpggMetaDeps): Job {
  return {
    name: "opgg-meta",
    schedule: OPGG_META_SCHEDULE,
    runOnStart: false,
    async run() {
      const patch = await deps.getCurrentPatch();
      if (!patch) throw new Error("パッチが未取り込みです");

      const catalog = await deps.listChampions();
      const transport = await deps.connect();
      const client = createOpggClient(transport);
      try {
        const rows = await client.listLaneMeta(catalog);
        await deps.save({ patch, tier: DEFAULT_RANK_TIER, rows });
        return { patch, tier: DEFAULT_RANK_TIER, rows: rows.length };
      } finally {
        await client.close();
      }
    },
  };
}
