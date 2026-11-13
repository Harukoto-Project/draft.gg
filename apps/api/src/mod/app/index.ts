import {
  createDraftStore,
  createProfileStore,
  createTeamStore,
  getCurrentPatch,
  listChampions,
  listLastSuccessfulRuns,
  loadProChampions,
} from "@draftgg/db";
import type { Database } from "@draftgg/db";
import { Hono } from "hono";

import type { MetaSource } from "../../routes/meta.js";
import type { RecommendationSource } from "../../routes/recommendations.js";
import { createRoutes } from "../../routes/index.js";
import { createAuthGateway } from "../auth/index.js";
import type { AuthConfig } from "../config/index.js";
import type { PoolSync } from "../pool-sync/index.js";

export interface AppDeps {
  db: Database;
  /** null のときはログインなしで動く */
  auth: AuthConfig | null;
  /** 提案計算用の統計(Node ではメモリに常駐、Workers では isolate ごとのキャッシュ) */
  stats: MetaSource & RecommendationSource;
  poolSync: PoolSync;
}

/**
 * api の Hono アプリを組み立てる。Node の常駐サーバーと Cloudflare Workers の両方から使う。
 * Workers ではリクエストごとに呼ぶので、ここでは接続やタイマーを作らない。
 */
export function createApp(deps: AppDeps) {
  const { db } = deps;
  const app = new Hono().route(
    "/api",
    createRoutes({
      auth: deps.auth ? createAuthGateway(db, deps.auth) : null,
      allowedOrigin: deps.auth?.baseUrl ?? null,
      champions: {
        getCurrentPatch: () => getCurrentPatch(db),
        listChampions: () => listChampions(db),
      },
      meta: deps.stats,
      snapshot: deps.stats,
      recommendations: deps.stats,
      pro: { load: (query) => loadProChampions(db, query) },
      profiles: { store: createProfileStore(db), sync: deps.poolSync },
      teams: { store: createTeamStore(db) },
      drafts: { store: createDraftStore(db) },
      status: {
        getCurrentPatch: () => getCurrentPatch(db),
        listLastSuccessfulRuns: (jobs) => listLastSuccessfulRuns(db, jobs),
      },
    }),
  );

  // 想定外のエラーは内容を返さず、ログにだけ残す
  app.onError((error, c) => {
    console.log(JSON.stringify({ level: "error", msg: "request failed", error: error.message }));
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
