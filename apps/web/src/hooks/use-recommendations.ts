import type { DraftState } from "@draftgg/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { loadRecommendations } from "@/services/recommendations";

/** ドラフトの入力が変わるたびに提案を取り直す。前回の結果は、次が届くまで見せ続ける */
export function useRecommendations(draft: DraftState, enabled: boolean) {
  return useQuery({
    queryKey: ["recommendations", draft],
    queryFn: ({ signal }) => loadRecommendations(draft, signal),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
