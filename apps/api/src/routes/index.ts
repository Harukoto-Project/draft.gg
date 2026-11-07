import { Hono } from "hono";

import type { DraftStore, ProfileStore, TeamStore } from "@draftgg/db";
import type { AuthGateway } from "../mod/auth/index.js";
import type { PoolSync } from "../mod/pool-sync/index.js";
import { createAuthRoute } from "./auth.js";
import { createChampionsRoute } from "./champions.js";
import type { ChampionsReader } from "./champions.js";
import { createDraftsRoute } from "./drafts.js";
import { health } from "./health.js";
import { createMeRoute } from "./me.js";
import { createMetaRoute } from "./meta.js";
import type { MetaSource } from "./meta.js";
import { createProfilesRoute } from "./profiles.js";
import { createProRoute } from "./pro.js";
import type { ProReader } from "./pro.js";
import { createRecommendationsRoute } from "./recommendations.js";
import type { RecommendationSource } from "./recommendations.js";
import { createTeamsRoute } from "./teams.js";

export interface RouteDeps {
  /** null のときはログインなしで動く */
  auth: AuthGateway | null;
  champions: ChampionsReader;
  meta: MetaSource;
  recommendations: RecommendationSource;
  pro: ProReader;
  profiles: { store: ProfileStore; sync: PoolSync };
  teams: { store: TeamStore };
  drafts: { store: DraftStore };
}

// 1エンドポイント群 = 1ファイル。新しいルートはここに登録する。
export function createRoutes(deps: RouteDeps) {
  return new Hono()
    .route("/health", health)
    .route("/auth", createAuthRoute(deps.auth))
    .route("/me", createMeRoute(deps.auth))
    .route("/me/profiles", createProfilesRoute({ auth: deps.auth, ...deps.profiles }))
    .route("/me/teams", createTeamsRoute({ auth: deps.auth, ...deps.teams }))
    .route("/me/drafts", createDraftsRoute({ auth: deps.auth, ...deps.drafts }))
    .route("/champions", createChampionsRoute(deps.champions))
    .route("/meta", createMetaRoute(deps.meta))
    .route("/pro", createProRoute(deps.pro))
    .route("/recommendations", createRecommendationsRoute(deps.recommendations));
}
