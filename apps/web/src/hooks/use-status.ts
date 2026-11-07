import { useQuery } from "@tanstack/react-query";

import { loadStatus } from "@/services/status";

export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => loadStatus(signal),
    staleTime: 60 * 1000,
  });
}
