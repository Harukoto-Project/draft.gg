import type { DraftState, PoolHints, RecommendationRequest } from "@draftgg/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { loadRecommendations } from "@/services/recommendations";

/** ドラフトの入力が変わるたびに提案を取り直す。前回の結果は、次が届くまで見せ続ける */
export function useRecommendations(
  draft: DraftState,
  enabled: boolean,
  pools?: PoolHints,
  weights?: RecommendationRequest["weights"],
) {
  return useQuery({
    queryKey: ["recommendations", draft, pools ?? null, weights ?? null],
    queryFn: ({ signal }) => loadRecommendations(draft, pools, weights, signal),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
