import { patchOf } from "@draftgg/data-sources";
import type { DdragonClient } from "@draftgg/data-sources";

import type { Job } from "../runner/index.js";

export interface ChampionMasterSaver {
  (input: {
    patch: string;
    champions: Awaited<ReturnType<DdragonClient["fetchChampions"]>>;
  }): Promise<void>;
}

/**
 * Data Dragon からパッチ番号とチャンピオン一覧を取得し、DB に保存する。
 * 保存は1トランザクションで行うため、失敗しても前回のデータが残る。
 */
export function createDdragonJob(deps: { client: DdragonClient; save: ChampionMasterSaver }): Job {
  return {
    name: "ddragon",
    schedule: "0 4 * * *",
    runOnStart: true,
    async run() {
      const version = await deps.client.fetchLatestVersion();
      const champions = await deps.client.fetchChampions(version);
      const patch = patchOf(version);
      await deps.save({ patch, champions });
      return { version, patch, champions: champions.length };
    },
  };
}
