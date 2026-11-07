import { useQuery } from "@tanstack/react-query";

import { loadChampions } from "@/services/champions";

export function useChampions() {
  return useQuery({
    queryKey: ["champions"],
    queryFn: loadChampions,
    staleTime: 5 * 60 * 1000,
  });
}
