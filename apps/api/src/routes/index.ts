import { Hono } from "hono";

import { createChampionsRoute } from "./champions.js";
import type { ChampionsReader } from "./champions.js";
import { health } from "./health.js";

export interface RouteDeps {
  champions: ChampionsReader;
}

// 1エンドポイント群 = 1ファイル。新しいルートはここに登録する。
export function createRoutes(deps: RouteDeps) {
  return new Hono()
    .route("/health", health)
    .route("/champions", createChampionsRoute(deps.champions));
}
