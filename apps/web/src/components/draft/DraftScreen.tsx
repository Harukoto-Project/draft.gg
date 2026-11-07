"use client";

import { championIdsInUse, suggestedSteps, turnsFor } from "@draftgg/shared";
import type { Champion, DraftState, DraftTurn } from "@draftgg/shared";
import { useMemo } from "react";

import { ChampionGrid } from "@/components/champion/ChampionGrid";
import { DraftBans } from "@/components/draft/DraftBans";
import { DraftPicks } from "@/components/draft/DraftPicks";
import { DraftScreenSkeleton } from "@/components/draft/DraftScreenSkeleton";
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-3 lg:h-full lg:grid-cols-[16rem_minmax(0,1fr)_16rem] lg:grid-rows-[auto_minmax(0,1fr)]">
          <DraftBans
            side="blue"
            championsById={championsById}
            className="order-1 lg:order-none lg:col-start-1 lg:row-start-1"
          />
          <p
            className="order-3 col-span-2 flex items-center justify-center bg-card px-3 py-2 text-center text-base font-semibold text-gold lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1"
            aria-live="polite"
          >
            {turnHint(draft.state)}
          </p>
          <DraftBans
            side="red"
            championsById={championsById}
            className="order-2 lg:order-none lg:col-start-3 lg:row-start-1"
          />
          <DraftPicks
            side="blue"
            championsById={championsById}
            className="order-4 lg:order-none lg:col-start-1 lg:row-start-2"
          />
          <div className="order-6 col-span-2 flex h-[28rem] min-h-0 flex-col overflow-hidden bg-card p-3 lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:h-auto">
            <div className="min-h-0 flex-1">
              <ChampionGrid
                taken={championIdsInUse(draft.state)}
                canPick={draft.activeStep !== null}
                onPick={draft.pickChampion}
              />
            </div>
          </div>
          <DraftPicks
            side="red"
            championsById={championsById}
            className="order-5 lg:order-none lg:col-start-3 lg:row-start-2"
          />
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
