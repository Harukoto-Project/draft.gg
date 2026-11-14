import { championMatchesQuery } from "@draftgg/shared";
import type { Champion } from "@draftgg/shared";
import { useMemo, useState } from "react";

import { ChampionGridSkeleton } from "@/components/champion/ChampionGridSkeleton";
import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { RoleFilter } from "@/components/champion/RoleFilter";
import type { RoleFilterValue } from "@/components/champion/RoleFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChampions } from "@/hooks/use-champions";
import { useRoleChampions } from "@/hooks/use-role-champions";
import { registerChampionSearch } from "@/lib/championSearchFocus";
import { formatMessage } from "@/lib/formatMessage";
import { modifierKeyLabel } from "@/lib/platform";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function ChampionGrid({
  taken,
  canPick,
  onPick,
}: {
  taken: ReadonlySet<string>;
  canPick: boolean;
  onPick: (championId: string) => void;
}) {
  const query = useChampions();
  const [search, setSearch] = useState("");

  if (query.isPending) return <ChampionGridSkeleton />;

  if (query.isError) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-3">
        <p className="text-sm text-foreground">{ja.draft.loadError}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {ja.draft.retry}
        </Button>
      </div>
    );
  }

  if (query.data.champions.length === 0) {
    return (
      <div className="flex h-full items-center">
        <p className="max-w-sm text-sm text-foreground">{ja.draft.emptyCatalog}</p>
      </div>
    );
  }

  return (
    <ChampionResults
      champions={query.data.champions}
      search={search}
      onSearch={setSearch}
      taken={taken}
      canPick={canPick}
      onPick={onPick}
    />
  );
}

function ChampionResults({
  champions,
  search,
  onSearch,
  taken,
  canPick,
  onPick,
}: {
  champions: Champion[];
  search: string;
  onSearch: (value: string) => void;
  taken: ReadonlySet<string>;
  canPick: boolean;
  onPick: (championId: string) => void;
}) {
  const [role, setRole] = useState<RoleFilterValue>("all");
  const roleChampions = useRoleChampions().data ?? null;
  const visible = useMemo(
    () =>
      champions
        .filter((champion) => championMatchesQuery(champion, search))
        .filter(
          (champion) =>
            role === "all" || roleChampions === null || !!roleChampions.get(role)?.has(champion.id),
        )
        .sort((left, right) => left.nameJa.localeCompare(right.nameJa, "ja")),
    [champions, search, role, roleChampions],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <RoleFilter value={role} onChange={setRole} disabled={roleChampions === null} />
        <Input
          ref={registerChampionSearch}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            // 日本語入力の変換確定の Enter では、ピックしない
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              const first = visible.find((champion) => !taken.has(champion.id));
              if (first && canPick) {
                onPick(first.id);
                onSearch("");
              }
            } else if (event.key === "Escape" && search) {
              onSearch("");
            }
          }}
          placeholder={`${ja.draft.searchPlaceholder} (${modifierKeyLabel()}K)`}
          aria-label={ja.draft.searchPlaceholder}
          aria-keyshortcuts="Control+K Meta+K"
          className="max-w-xs min-w-40 flex-1"
        />
        <p className="shrink-0 text-xs text-muted-foreground">
          {formatMessage(ja.draft.searchCount, { count: String(visible.length) })}
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-foreground">{ja.draft.noMatches}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1">
            {visible.map((champion) => {
              const used = taken.has(champion.id);
              return (
                <button
                  key={champion.id}
                  type="button"
                  disabled={!canPick || used}
                  aria-label={used ? `${champion.nameJa}、${ja.draft.taken}` : champion.nameJa}
                  onClick={() => onPick(champion.id)}
                  className={cn(
                    "flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xs p-1.5 outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                    used && "opacity-40",
                  )}
                >
                  <span className="relative size-14 overflow-hidden rounded-xs">
                    <ChampionIcon champion={champion} />
                  </span>
                  <span className="w-full truncate text-xs text-foreground">{champion.nameJa}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
