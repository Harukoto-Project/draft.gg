import type { ProLeague } from "@draftgg/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { loadProChampions } from "@/services/pro";

export function useProStats(query: { league?: ProLeague; patch?: string }) {
  return useQuery({
    queryKey: ["pro-champions", query.league ?? null, query.patch ?? null],
    queryFn: ({ signal }) => loadProChampions(query, signal),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
