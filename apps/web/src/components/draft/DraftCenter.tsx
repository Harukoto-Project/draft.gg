"use client";

import { championIdsInUse } from "@draftgg/shared";
import type { Champion } from "@draftgg/shared";
import { useState } from "react";

import { ChampionGrid } from "@/components/champion/ChampionGrid";
import { RecommendationPanel } from "@/components/recommendation/RecommendationPanel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDraft } from "@/hooks/use-draft";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

type Tab = "champions" | "suggestions";

/** 中央の列。広い画面ではチャンピオン一覧と提案を並べ、狭い画面ではタブで切り替える */
export function DraftCenter({
  championsById,
  className,
}: {
  championsById: ReadonlyMap<string, Champion>;
  className?: string;
}) {
  const draft = useDraft();
  const [tab, setTab] = useState<Tab>("champions");
  const activeAction =
    draft.activeStep === null
      ? undefined
      : draft.state.actions.find((action) => action.step === draft.activeStep);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3 overflow-hidden bg-card p-3", className)}>
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:grid-rows-[minmax(0,1fr)]">
        <div className={cn("min-h-0 flex-1", tab !== "champions" && "hidden xl:block")}>
          <ChampionGrid
            taken={championIdsInUse(draft.state)}
            canPick={draft.activeStep !== null}
            onPick={draft.pickChampion}
          />
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 xl:border-l xl:border-border xl:pl-4",
            tab !== "suggestions" && "hidden xl:block",
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
