import { Hono } from "hono";

import { createChampionsRoute } from "./champions.js";
import type { ChampionsReader } from "./champions.js";
import { health } from "./health.js";
import { createMetaRoute } from "./meta.js";
import type { MetaSource } from "./meta.js";
import { createProRoute } from "./pro.js";
import type { ProReader } from "./pro.js";
import { createRecommendationsRoute } from "./recommendations.js";
import type { RecommendationSource } from "./recommendations.js";

export interface RouteDeps {
  champions: ChampionsReader;
  meta: MetaSource;
  recommendations: RecommendationSource;
  pro: ProReader;
}

// 1エンドポイント群 = 1ファイル。新しいルートはここに登録する。
export function createRoutes(deps: RouteDeps) {
  return new Hono()
    .route("/health", health)
    .route("/champions", createChampionsRoute(deps.champions))
    .route("/meta", createMetaRoute(deps.meta))
    .route("/pro", createProRoute(deps.pro))
    .route("/recommendations", createRecommendationsRoute(deps.recommendations));
}
