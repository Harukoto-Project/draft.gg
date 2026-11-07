"use client";

import { championMatchesQuery } from "@draftgg/shared";
import type { Champion, ProLeague } from "@draftgg/shared";
import { useMemo, useState } from "react";

import { RoleFilter } from "@/components/champion/RoleFilter";
import type { RoleFilterValue } from "@/components/champion/RoleFilter";
import { ProFilters } from "@/components/pro/ProFilters";
import { ProStatsTable } from "@/components/pro/ProStatsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useChampions } from "@/hooks/use-champions";
import { useProStats } from "@/hooks/use-pro-stats";
import { formatMessage } from "@/lib/formatMessage";
import { sortProStats } from "@/lib/proStats";
import type { ProSortKey, SortDirection } from "@/lib/proStats";
import ja from "@/messages/ja.json";

export function ProStatsScreen() {
  const [league, setLeague] = useState<ProLeague | undefined>(undefined);
  const [patch, setPatch] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<RoleFilterValue>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: ProSortKey; direction: SortDirection }>({
    key: "presence",
    direction: "desc",
  });

  const stats = useProStats({ league, patch });
  // 選べるパッチは、選んだリーグ(未選択なら全体)の直近のパッチ
  const recent = useProStats({ league });
  const champions = useChampions();
  const championsById = useMemo(() => {
    const map = new Map<string, Champion>();
    for (const champion of champions.data?.champions ?? []) map.set(champion.id, champion);
    return map;
  }, [champions.data]);

  const rows = useMemo(() => {
    const filtered = (stats.data?.stats ?? [])
      .filter((row) => role === "all" || row.position === role)
      .filter((row) => {
        const champion = championsById.get(row.championId);
        return champion ? championMatchesQuery(champion, search) : row.nameJa.includes(search);
      });
    return sortProStats(filtered, sort.key, sort.direction);
  }, [stats.data, role, search, sort, championsById]);

  function changeSort(key: ProSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  }

  const games = stats.data?.stats[0]?.games ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <div className="flex shrink-0 flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{ja.pro.title}</h1>
        <p className="text-xs text-muted-foreground">{ja.pro.description}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-3 bg-card p-3">
        <ProFilters
          league={league}
          onLeagueChange={(next) => {
            setLeague(next);
            // パッチはリーグごとに違うため、選び直してもらう
            setPatch(undefined);
          }}
          patch={patch}
          patches={recent.data?.patches ?? []}
          onPatchChange={setPatch}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <RoleFilter value={role} onChange={setRole} disabled={false} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ja.pro.searchPlaceholder}
            aria-label={ja.pro.searchPlaceholder}
            className="max-w-xs min-w-40 flex-1"
          />
          <p className="shrink-0 text-xs text-muted-foreground">
            {formatMessage(ja.pro.count, { count: String(rows.length) })}
          </p>
        </div>
        {stats.data ? (
          <p className="text-xs text-muted-foreground">
            {games > 0
              ? formatMessage(ja.pro.scopeSummary, {
                  patches: stats.data.patches.join("・"),
                  games: String(games),
                })
              : ja.pro.scopeNone}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-card" aria-busy={stats.isFetching}>
        {stats.isPending ? (
          <div className="flex flex-col gap-1 p-3" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : stats.isError && !stats.data ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-foreground">{ja.pro.loadError}</p>
            <Button variant="outline" onClick={() => void stats.refetch()}>
              {ja.pro.retry}
            </Button>
          </div>
        ) : stats.data && stats.data.stats.length === 0 ? (
          <p className="p-4 text-sm text-foreground">{ja.pro.empty}</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-foreground">{ja.pro.noMatches}</p>
        ) : (
          <ProStatsTable
            rows={rows}
            championsById={championsById}
            sortKey={sort.key}
            direction={sort.direction}
            onSort={changeSort}
          />
        )}
      </div>
    </div>
  );
}
