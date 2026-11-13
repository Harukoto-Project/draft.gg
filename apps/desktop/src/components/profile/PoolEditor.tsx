import { MAX_POOL_ENTRIES } from "@draftgg/shared";
import type { Champion, PoolEntry, Position, Profile } from "@draftgg/shared";
import { useMemo } from "react";

import { PoolAddForm } from "@/components/profile/PoolAddForm";
import { PoolTable } from "@/components/profile/PoolTable";
import { useChampions } from "@/hooks/use-champions";
import { useReplacePool } from "@/hooks/use-profiles";
import { formatMessage } from "@/lib/formatMessage";
import { profileErrorMessage } from "@/lib/profileErrors";
import { addManualEntry, canAddEntry, removeEntry, setExcluded, sortPool } from "@/lib/profilePool";
import ja from "@/messages/ja.json";

export function PoolEditor({ profile }: { profile: Profile }) {
  const champions = useChampions();
  const replace = useReplacePool();

  const championList = useMemo<readonly Champion[]>(
    () => champions.data?.champions ?? [],
    [champions.data],
  );
  const championsById = useMemo(
    () => new Map(championList.map((champion) => [champion.id, champion])),
    [championList],
  );
  const entries = useMemo(() => sortPool(profile.pool), [profile.pool]);
  const busy = replace.isPending;
  const defaultRole: Position = profile.roles[0] ?? "mid";
  const error = replace.error;

  function save(next: PoolEntry[]) {
    replace.mutate({ id: profile.id, entries: next });
  }

  return (
    <section className="flex flex-col gap-3" aria-label={ja.profiles.pool.title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold text-foreground">{ja.profiles.pool.title}</h2>
        <span className="text-xs text-muted-foreground">
          {formatMessage(ja.profiles.pool.count, { count: String(profile.pool.length) })}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {profileErrorMessage(error)}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-foreground">{ja.profiles.pool.empty}</p>
      ) : (
        <PoolTable
          entries={entries}
          championsById={championsById}
          disabled={busy}
          onToggleExcluded={(entry) => save(setExcluded(profile.pool, entry, !entry.excluded))}
          onRemove={(entry) => save(removeEntry(profile.pool, entry))}
        />
      )}

      {canAddEntry(profile.pool) ? (
        <PoolAddForm
          // ロールの初期値を、プレイヤーを切り替えたときに作り直す
          key={profile.id}
          champions={championList}
          entries={profile.pool}
          defaultRole={defaultRole}
          disabled={busy}
          onAdd={(championId, position) => save(addManualEntry(profile.pool, championId, position))}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {formatMessage(ja.profiles.pool.limit, { max: String(MAX_POOL_ENTRIES) })}
        </p>
      )}
    </section>
  );
}
