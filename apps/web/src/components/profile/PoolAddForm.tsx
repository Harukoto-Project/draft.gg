"use client";

import { POSITION_LABELS, POSITIONS, championMatchesQuery } from "@draftgg/shared";
import type { Champion, PoolEntry, Position } from "@draftgg/shared";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { RoleIconButton } from "@/components/role/RoleIconButton";
import { Input } from "@/components/ui/input";
import { formatMessage } from "@/lib/formatMessage";
import { entryKey } from "@/lib/profilePool";
import ja from "@/messages/ja.json";

const MAX_SUGGESTIONS = 8;

/** チャンピオンを検索して、選んだロールのプールへ手動で追加する */
export function PoolAddForm({
  champions,
  entries,
  defaultRole,
  disabled,
  onAdd,
}: {
  champions: readonly Champion[];
  entries: readonly PoolEntry[];
  defaultRole: Position;
  disabled: boolean;
  onAdd: (championId: string, position: Position) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Position>(defaultRole);

  const matches = useMemo(() => {
    const taken = new Set(entries.map(entryKey));
    if (query.trim().length === 0) return [];
    return champions
      .filter((champion) => !taken.has(entryKey({ championId: champion.id, position: role })))
      .filter((champion) => championMatchesQuery(champion, query))
      .slice(0, MAX_SUGGESTIONS);
  }, [champions, entries, query, role]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{ja.profiles.pool.addTitle}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label={ja.profiles.pool.addRole} className="flex items-center gap-1">
          {POSITIONS.map((position) => (
            <RoleIconButton
              key={position}
              position={position}
              pressed={role === position}
              onClick={() => setRole(position)}
            />
          ))}
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ja.profiles.pool.addSearch}
          aria-label={ja.profiles.pool.addSearch}
          className="max-w-xs min-w-40 flex-1"
        />
      </div>
      {query.trim().length > 0 ? (
        matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">{ja.profiles.pool.addNoMatches}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {matches.map((champion) => (
              <li key={champion.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={formatMessage(ja.profiles.pool.addLabel, {
                    champion: champion.nameJa,
                    role: POSITION_LABELS[role],
                  })}
                  onClick={() => {
                    onAdd(champion.id, role);
                    setQuery("");
                  }}
                  className="flex cursor-pointer items-center gap-2 border border-border px-2 py-1 text-sm text-foreground transition-colors hover:border-gold/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="relative size-6 shrink-0 overflow-hidden bg-muted">
                    <ChampionIcon champion={champion} />
                  </span>
                  {champion.nameJa}
                  <Plus className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
