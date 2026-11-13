import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isTauri } from "@/lib/platform";
import { refreshSnapshot } from "@/services/snapshot";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 統計スナップショットを、起動時とその後 10 分ごとに更新する(変わっていなければ api は 304 を返す)。
 * 入れ替わったら、提案を取り直す
 */
export function useSnapshotSync() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["snapshot-sync"],
    enabled: isTauri,
    queryFn: async () => {
      const report = await refreshSnapshot();
      if (report.outcome === "updated") {
        await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      }
      return report;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
  });
}
