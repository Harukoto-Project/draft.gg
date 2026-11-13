import { recommendationResponseSchema } from "@draftgg/shared";
import type {
  DraftState,
  PoolHints,
  RecommendationRequest,
  RecommendationResponse,
} from "@draftgg/shared";

import { apiFetch } from "@/services/http";

export async function loadRecommendations(
  draft: DraftState,
  pools?: PoolHints,
  weights?: RecommendationRequest["weights"],
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await apiFetch("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft, pools, weights }),
    signal,
  });
  if (!response.ok) {
    throw new Error("recommendations_unavailable");
  }

  const body: unknown = await response.json();
  return recommendationResponseSchema.parse(body);
}
