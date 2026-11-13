import type { Champion } from "@draftgg/shared";
import { useMemo } from "react";

import { DraftCenter } from "@/components/draft/DraftCenter";
import { DraftScreenSkeleton } from "@/components/draft/DraftScreenSkeleton";
import { DraftSide } from "@/components/draft/DraftSide";
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

/**
 * 上に 2 陣営の帯(BAN とピック)、下にチャンピオン一覧と推薦を置く。
 * 縦が足りないときは全体がスクロールし、一覧の高さは下限を保つ。
 */
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <DraftToolbar />
      <div className="grid shrink-0 grid-cols-1 gap-2 px-3 md:grid-cols-2">
        <DraftSide side="blue" championsById={championsById} />
        <DraftSide side="red" championsById={championsById} />
      </div>
      <DraftCenter championsById={championsById} className="min-h-96 flex-1" />
    </div>
  );
}
