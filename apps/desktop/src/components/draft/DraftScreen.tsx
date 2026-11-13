import type { Champion } from "@draftgg/shared";
import { useMemo } from "react";

import { DraftBans } from "@/components/draft/DraftBans";
import { DraftCenter } from "@/components/draft/DraftCenter";
import { DraftPicks } from "@/components/draft/DraftPicks";
import { DraftScreenSkeleton } from "@/components/draft/DraftScreenSkeleton";
import { DraftToolbar } from "@/components/draft/DraftToolbar";
import { DraftProvider } from "@/contexts/DraftContext";
import { useChampions } from "@/hooks/use-champions";
import { useDraft } from "@/hooks/use-draft";
export function DraftScreen() {
  return (
    <DraftProvider>
      <DraftWorkspace />
    </DraftProvider>
  );
}

function DraftWorkspace() {
  const draft = useDraft();
  const champions = useChampions();
  const championsById = useMemo(() => {
    const map = new Map<string, Champion>();
    for (const champion of champions.data?.champions ?? []) {
      map.set(champion.id, champion);
    }
    return map;
  }, [champions.data]);

  if (!draft.ready) return <DraftScreenSkeleton />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DraftToolbar patch={champions.data?.patch ?? null} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
          <DraftBans
            side="blue"
            championsById={championsById}
            className="lg:col-start-1 lg:row-start-1"
          />
          <DraftBans
            side="red"
            championsById={championsById}
            className="lg:col-start-3 lg:row-start-1"
          />
          <DraftPicks
            side="blue"
            championsById={championsById}
            className="lg:col-start-1 lg:row-start-2"
          />
          <DraftPicks
            side="red"
            championsById={championsById}
            className="lg:col-start-3 lg:row-start-2"
          />
          <DraftCenter
            championsById={championsById}
            className="col-span-2 h-[36rem] lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto"
          />
        </div>
      </div>
    </div>
  );
}
