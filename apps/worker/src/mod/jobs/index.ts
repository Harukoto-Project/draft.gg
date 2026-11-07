import { connectOpggTransport, createDdragonClient } from "@draftgg/data-sources";
import type { OpggTransport } from "@draftgg/data-sources";
import {
  getCurrentPatch,
  listChampions,
  listMajorRoles,
  saveChampionMaster,
  saveChampionStats,
  saveLaneMeta,
} from "@draftgg/db";
import type { Database } from "@draftgg/db";
import { DEFAULT_RANK_TIER, MAJOR_ROLE_RATE } from "@draftgg/shared";

import type { Job } from "../runner/index.js";
import { createDdragonJob } from "./ddragon.js";
import { createOpggChampionJob } from "./opgg-champion.js";
import { createOpggMetaJob } from "./opgg-meta.js";

export interface JobHooks {
  /** 新しいパッチを保存したあと。OP.GG のジョブを前倒しする */
  onNewPatch?: (patch: string) => void;
  connectOpgg?: () => Promise<OpggTransport>;
}

/** 常駐スケジューラに登録するジョブ。1ジョブ = 1ファイルで追加し、ここに並べる。 */
export function createJobs(db: Database, hooks: JobHooks = {}): Job[] {
  const connect = hooks.connectOpgg ?? connectOpggTransport;
  const champions = () => listChampions(db);

  return [
    createDdragonJob({
      client: createDdragonClient(),
      save: (input) => saveChampionMaster(db, input),
      getCurrentPatch: () => getCurrentPatch(db),
      onNewPatch: hooks.onNewPatch,
    }),
    createOpggMetaJob({
      connect,
      listChampions: champions,
      getCurrentPatch: () => getCurrentPatch(db),
      save: (input) => saveLaneMeta(db, input),
    }),
    createOpggChampionJob({
      connect,
      listChampions: champions,
      getCurrentPatch: () => getCurrentPatch(db),
      listTargets: () => listMajorRoles(db, DEFAULT_RANK_TIER, MAJOR_ROLE_RATE),
      save: (input) => saveChampionStats(db, input),
    }),
  ];
}
