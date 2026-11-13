import { POSITION_LABELS } from "@draftgg/shared";
import type { Champion, PoolEntry } from "@draftgg/shared";
import { Eye, EyeOff, Trash2 } from "lucide-react";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { RoleIcon } from "@/components/role/RoleIcon";
import { Button } from "@/components/ui/button";
import { formatMessage } from "@/lib/formatMessage";
import { entryKey } from "@/lib/profilePool";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function PoolTable({
  entries,
  championsById,
  disabled,
  onToggleExcluded,
  onRemove,
}: {
  entries: readonly PoolEntry[];
  championsById: ReadonlyMap<string, Champion>;
  disabled: boolean;
  onToggleExcluded: (entry: PoolEntry) => void;
  onRemove: (entry: PoolEntry) => void;
}) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const champion = championsById.get(entry.championId);
        const name = champion?.nameJa ?? entry.championId;
        const names = { champion: name, role: POSITION_LABELS[entry.position] };
        return (
          <li
            key={entryKey(entry)}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/50 py-1.5",
              entry.excluded && "opacity-60",
            )}
          >
            <span className="relative size-8 shrink-0 overflow-hidden bg-muted">
              {champion ? <ChampionIcon champion={champion} /> : null}
            </span>
            <span className="min-w-24 flex-1 truncate text-sm text-foreground">{name}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <RoleIcon position={entry.position} className="size-4 opacity-75" />
              <span className="sr-only">{POSITION_LABELS[entry.position]}</span>
            </span>
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              {entry.source === "opgg"
                ? ja.profiles.pool.sourceOpgg
                : ja.profiles.pool.sourceManual}
            </span>
            <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {entry.games !== null && entry.winRate !== null
                ? `${formatMessage(ja.profiles.pool.games, { games: String(entry.games) })} ${formatRate(entry.winRate)}`
                : ""}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                title={entry.excluded ? ja.profiles.pool.include : ja.profiles.pool.exclude}
                aria-label={formatMessage(
                  entry.excluded ? ja.profiles.pool.includeLabel : ja.profiles.pool.excludeLabel,
                  names,
                )}
                onClick={() => onToggleExcluded(entry)}
              >
                {entry.excluded ? <Eye /> : <EyeOff />}
              </Button>
              {entry.source === "manual" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  title={ja.profiles.pool.remove}
                  aria-label={formatMessage(ja.profiles.pool.removeLabel, names)}
                  onClick={() => onRemove(entry)}
                >
                  <Trash2 />
                </Button>
              ) : (
                <span className="size-7" aria-hidden="true" />
              )}
            </span>
            {entry.excluded ? (
              <span className="text-xs text-muted-foreground">{ja.profiles.pool.excluded}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
