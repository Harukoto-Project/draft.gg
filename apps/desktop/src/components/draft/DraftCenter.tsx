import { championIdsInUse } from "@draftgg/shared";
import type { Champion } from "@draftgg/shared";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";

import { ChampionGrid } from "@/components/champion/ChampionGrid";
import { InspectorSplitter } from "@/components/draft/InspectorSplitter";
import { RecommendationPanel } from "@/components/recommendation/RecommendationPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDraft } from "@/hooks/use-draft";
import { useInspectorLayout } from "@/hooks/use-inspector-layout";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

type Tab = "champions" | "suggestions";

/**
 * 中央の列。広い画面ではチャンピオン一覧(作業面)と推薦(インスペクター)を並べ、
 * 境界線で推薦の幅を変えたり、閉じたりできる。狭い画面ではタブで切り替える。
 */
export function DraftCenter({
  championsById,
  className,
}: {
  championsById: ReadonlyMap<string, Champion>;
  className?: string;
}) {
  const draft = useDraft();
  const inspector = useInspectorLayout();
  const [tab, setTab] = useState<Tab>("champions");
  const bodyRef = useRef<HTMLDivElement>(null);
  const activeAction =
    draft.activeStep === null
      ? undefined
      : draft.state.actions.find((action) => action.step === draft.activeStep);

  return (
    <div className={cn("flex min-h-0 flex-col gap-2 overflow-hidden bg-card p-3", className)}>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        spacing={0}
        value={tab}
        aria-label={ja.recommendation.view}
        className="xl:hidden"
        onValueChange={(value) => {
          if (value === "champions" || value === "suggestions") setTab(value);
        }}
      >
        <ToggleGroupItem value="champions">{ja.recommendation.tabChampions}</ToggleGroupItem>
        <ToggleGroupItem value="suggestions">{ja.recommendation.tabSuggestions}</ToggleGroupItem>
      </ToggleGroup>
      <div
        ref={bodyRef}
        style={{ "--inspector-w": `${inspector.width}px` } as CSSProperties}
        className={cn(
          "flex min-h-0 flex-1 flex-col xl:grid xl:grid-rows-[minmax(0,1fr)]",
          inspector.open
            ? "xl:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--inspector-w),55%)]"
            : "xl:grid-cols-[minmax(0,1fr)]",
        )}
      >
        <div className={cn("min-h-0 flex-1", tab !== "champions" && "hidden xl:block")}>
          <ChampionGrid
            taken={championIdsInUse(draft.state)}
            canPick={draft.activeStep !== null}
            onPick={draft.pickChampion}
          />
        </div>
        {inspector.open ? (
          <InspectorSplitter
            width={inspector.width}
            containerRef={bodyRef}
            onWidthChange={inspector.setWidth}
            onCollapse={() => inspector.setOpen(false)}
          />
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1",
            tab !== "suggestions" && "hidden",
            inspector.open ? "xl:block" : "xl:hidden",
          )}
        >
          <RecommendationPanel
            championsById={championsById}
            activeType={activeAction?.type ?? null}
            onPick={draft.pickChampion}
          />
        </div>
      </div>
    </div>
  );
}
