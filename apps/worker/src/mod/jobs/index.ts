import {
  connectOpggTransport,
  createDdragonClient,
  createLeaguepediaClient,
  createOraclesElixirClient,
} from "@draftgg/data-sources";
import type { OpggTransport } from "@draftgg/data-sources";
import {
  fillProOrders,
  getCurrentPatch,
  listChampions,
  listMajorRoles,
  listStoredProGames,
  replaceProChampionStats,
  saveChampionMaster,
  saveChampionStats,
  saveLaneMeta,
  saveProGames,
} from "@draftgg/db";
import type { Database } from "@draftgg/db";
import { DEFAULT_RANK_TIER, MAJOR_ROLE_RATE } from "@draftgg/shared";

import type { Job } from "../runner/index.js";
import type { LeaguepediaCredentials } from "./pro-leaguepedia.js";
import { createDdragonJob } from "./ddragon.js";
import { createOpggChampionJob } from "./opgg-champion.js";
import { createOpggMetaJob } from "./opgg-meta.js";
import { createProAggregateJob } from "./pro-aggregate.js";
import { createProLeaguepediaJob } from "./pro-leaguepedia.js";
import { createProOraclesJob } from "./pro-oracles.js";

export interface JobHooks {
  /** 新しいパッチを保存したあと。OP.GG のジョブを前倒しする */
  onNewPatch?: (patch: string) => void;
  /** pro-oracles が保存したあと。Leaguepedia と集計を続ける */
  onProImported?: () => void;
  connectOpgg?: () => Promise<OpggTransport>;
  leaguepedia?: LeaguepediaCredentials | null;
  /** 設定されていれば、公開フォルダの代わりにこの CSV を取る */
  oraclesFileUrl?: string;
  /** 設定されていれば、ネットワークを使わずにこのローカルの CSV を読む(oraclesFileUrl より優先) */
  oraclesFilePath?: string;
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
    createProOraclesJob({
      listChampions: champions,
      fetchGames: (catalog, signal) =>
        createOraclesElixirClient({
          fileUrl: hooks.oraclesFileUrl,
          filePath: hooks.oraclesFilePath,
        }).fetchGames(catalog, signal),
      save: (games) => saveProGames(db, games),
      onImported: hooks.onProImported,
    }),
    createProLeaguepediaJob({
      credentials: hooks.leaguepedia ?? null,
      listChampions: champions,
      listGames: () => listStoredProGames(db),
      fetchDrafts: (dates, signal) => {
        const credentials = hooks.leaguepedia;
        if (!credentials) return Promise.resolve([]);
        return createLeaguepediaClient({ credentials }).fetchDrafts(dates, signal);
      },
      fillOrders: (fills) => fillProOrders(db, fills),
    }),
    createProAggregateJob({
      listGames: () => listStoredProGames(db),
      save: (rows) => replaceProChampionStats(db, rows),
    }),
  ];
}
