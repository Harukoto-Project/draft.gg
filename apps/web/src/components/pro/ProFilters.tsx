import { PRO_LEAGUES } from "@draftgg/shared";
import type { ProLeague } from "@draftgg/shared";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ja from "@/messages/ja.json";

const ALL = "all";

function leagueLabel(league: ProLeague): string {
  return league === "FirstStand" ? ja.pro.leagueFirstStand : league;
}

export function ProFilters({
  league,
  onLeagueChange,
  patch,
  patches,
  onPatchChange,
}: {
  league: ProLeague | undefined;
  onLeagueChange: (league: ProLeague | undefined) => void;
  patch: string | undefined;
  /** 選べるパッチ(直近のもの)。新しい順 */
  patches: readonly string[];
  onPatchChange: (patch: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ja.pro.league}</span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={league ?? ALL}
          aria-label={ja.pro.league}
          className="flex-wrap"
          onValueChange={(value) => {
            if (value === ALL) onLeagueChange(undefined);
            else if ((PRO_LEAGUES as readonly string[]).includes(value))
              onLeagueChange(value as ProLeague);
          }}
        >
          <ToggleGroupItem value={ALL}>{ja.pro.leagueAll}</ToggleGroupItem>
          {PRO_LEAGUES.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {leagueLabel(item)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ja.pro.patch}</span>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={patch ?? ALL}
          aria-label={ja.pro.patch}
          onValueChange={(value) => {
            if (value === ALL) onPatchChange(undefined);
            else if (value) onPatchChange(value);
          }}
        >
          <ToggleGroupItem value={ALL}>{ja.pro.patchRecent}</ToggleGroupItem>
          {patches.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
