"use client";

import { championIdsInUse, suggestedSteps, turnsFor } from "@draftgg/shared";
import type { Champion, DraftState, DraftTurn } from "@draftgg/shared";
import { useMemo } from "react";

import { ChampionGrid } from "@/components/champion/ChampionGrid";
import { DraftScreenSkeleton } from "@/components/draft/DraftScreenSkeleton";
import { DraftSide } from "@/components/draft/DraftSide";
import { DraftToolbar } from "@/components/draft/DraftToolbar";
import { DraftProvider } from "@/contexts/DraftContext";
import { useChampions } from "@/hooks/use-champions";
import { useDraft } from "@/hooks/use-draft";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

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
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)_16rem] lg:grid-rows-1">
        <div className="grid max-h-[42svh] min-h-0 grid-cols-2 gap-3 overflow-hidden lg:contents lg:max-h-none">
          <div className="min-h-0 lg:col-start-1 lg:row-start-1">
            <DraftSide side="blue" championsById={championsById} />
          </div>
          <div className="min-h-0 lg:col-start-3 lg:row-start-1">
            <DraftSide side="red" championsById={championsById} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-md bg-card p-3 lg:col-start-2 lg:row-start-1">
          <p className="shrink-0 text-sm text-foreground" aria-live="polite">
            {turnHint(draft.state)}
          </p>
          <div className="min-h-0 flex-1">
            <ChampionGrid
              taken={championIdsInUse(draft.state)}
              canPick={draft.activeStep !== null}
              onPick={draft.pickChampion}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function turnHint(state: DraftState): string {
  const steps = suggestedSteps(state);
  if (steps.length === 0) return ja.draft.complete;

  const turns = steps.flatMap((step) => {
    const turn = turnsFor(state.format).find((candidate) => candidate.step === step);
    return turn ? [turn] : [];
  });
  const first = turns[0];
  if (!first) return ja.draft.chooseSlot;
  if (turns.length > 1 && turns.every((turn) => turn.type === "ban")) return ja.draft.nextBan;

  return formatMessage(ja.draft.nextAction, {
    side: sideLabel(first.side),
    type: typeLabel(first.type),
  });
}

function sideLabel(side: DraftTurn["side"]): string {
  return side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed;
}

function typeLabel(type: DraftTurn["type"]): string {
  return type === "ban" ? ja.draft.ban : ja.draft.pick;
}
