import { recommendationResponseSchema } from "@draftgg/shared";
import type { DraftState, PoolHints, RecommendationResponse } from "@draftgg/shared";

export async function loadRecommendations(
  draft: DraftState,
  pools?: PoolHints,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft, pools }),
    signal,
  });
  if (!response.ok) {
    throw new Error("recommendations_unavailable");
  }

  const body: unknown = await response.json();
  return recommendationResponseSchema.parse(body);
}
