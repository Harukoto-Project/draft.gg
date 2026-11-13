import { recommendationResponseSchema } from "@draftgg/shared";
import type {
  DraftState,
  PoolHints,
  RecommendationRequest,
  RecommendationResponse,
} from "@draftgg/shared";

import { isTauri } from "@/lib/platform";
import { apiFetch } from "@/services/http";
import { callCommand } from "@/services/tauri";

/**
 * 提案を取る。Tauri では手元のスナップショットを使い、Rust の engine で計算する。
 * ブラウザでの開発時だけ、api の `/api/recommendations` を使う
 */
export async function loadRecommendations(
  draft: DraftState,
  pools?: PoolHints,
  weights?: RecommendationRequest["weights"],
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const body: unknown = isTauri
    ? await callCommand("recommend", { request: { draft, pools, weights } })
    : await fetchFromApi(draft, pools, weights, signal);
  return recommendationResponseSchema.parse(body);
}

async function fetchFromApi(
  draft: DraftState,
  pools: PoolHints | undefined,
  weights: RecommendationRequest["weights"],
  signal: AbortSignal | undefined,
): Promise<unknown> {
  const response = await apiFetch("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft, pools, weights }),
    signal,
  });
  if (!response.ok) {
    throw new Error("recommendations_unavailable");
  }
  return response.json();
}
