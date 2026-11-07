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
export function createDdragonJob(deps: {
  client: DdragonClient;
  save: ChampionMasterSaver;
  /** 保存前の現在パッチ。変わったときだけ onNewPatch を呼ぶ */
  getCurrentPatch?: () => Promise<string | null>;
  /** 新しいパッチを保存したあと。OP.GG の取り込みを前倒しするときに使う */
  onNewPatch?: (patch: string) => void;
}): Job {
  return {
    name: "ddragon",
    schedule: "0 4 * * *",
    runOnStart: true,
    async run() {
      const previous = deps.getCurrentPatch ? await deps.getCurrentPatch() : null;
      const version = await deps.client.fetchLatestVersion();
      const champions = await deps.client.fetchChampions(version);
      const patch = patchOf(version);
      await deps.save({ patch, champions });
      if (deps.onNewPatch && previous !== patch) deps.onNewPatch(patch);
      return { version, patch, champions: champions.length };
    },
  };
}
