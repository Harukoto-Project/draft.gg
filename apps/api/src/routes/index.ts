import { Hono } from "hono";

import type { PoolSync } from "../mod/pool-sync/index.js";
import { createChampionsRoute } from "./champions.js";
import type { ChampionsReader } from "./champions.js";
import { health } from "./health.js";
import { createMetaRoute } from "./meta.js";
import type { MetaSource } from "./meta.js";
import { createPoolSyncRoute } from "./pool-sync.js";
import { createProRoute } from "./pro.js";
import type { ProReader } from "./pro.js";
import { createSnapshotRoute } from "./snapshot.js";
import type { SnapshotSource } from "./snapshot.js";
import { createStatusRoute } from "./status.js";
import type { StatusReader } from "./status.js";

export interface RouteDeps {
  champions: ChampionsReader;
  meta: MetaSource;
  snapshot: SnapshotSource;
  pro: ProReader;
  /** ログイン無しで使える、プールの取得(デスクトップアプリ用) */
  poolSync: PoolSync;
  status: StatusReader;
}

// 1エンドポイント群 = 1ファイル。新しいルートはここに登録する。
export function createRoutes(deps: RouteDeps) {
  return new Hono()
    .route("/health", health)
    .route("/status", createStatusRoute(deps.status))
    .route("/champions", createChampionsRoute(deps.champions))
    .route("/meta", createMetaRoute(deps.meta))
    .route("/pool-sync", createPoolSyncRoute({ sync: deps.poolSync }))
    .route("/pro", createProRoute(deps.pro))
    .route("/snapshot", createSnapshotRoute(deps.snapshot));
}
