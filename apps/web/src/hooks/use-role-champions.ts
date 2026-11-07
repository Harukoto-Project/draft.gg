import type { MetaResponse, Position } from "@draftgg/shared";
import { useQuery } from "@tanstack/react-query";

import { loadMeta } from "@/services/meta";

export type RoleChampions = ReadonlyMap<Position, ReadonlySet<string>>;

/** ロールごとの主なチャンピオン。統計が未取得なら null。 */
function toRoleChampions(meta: MetaResponse): RoleChampions | null {
  if (meta.stats.length === 0) return null;
  const map = new Map<Position, Set<string>>();
  for (const row of meta.stats) {
    const ids = map.get(row.position) ?? new Set<string>();
    ids.add(row.championId);
    map.set(row.position, ids);
  }
  return map;
}

export function useRoleChampions() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: loadMeta,
    staleTime: 5 * 60 * 1000,
    select: toRoleChampions,
  });
}
