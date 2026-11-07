import { recommendationResponseSchema } from "@draftgg/shared";
import type { DraftState, RecommendationResponse } from "@draftgg/shared";

export async function loadRecommendations(
  draft: DraftState,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft }),
    signal,
  });
  if (!response.ok) {
    throw new Error("recommendations_unavailable");
  }

  const body: unknown = await response.json();
  return recommendationResponseSchema.parse(body);
}
