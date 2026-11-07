"use client";

import { positionOfChampion, sideTurns, suggestedSteps } from "@draftgg/shared";
import type { Champion, Side } from "@draftgg/shared";

import { PickStrip } from "@/components/draft/PickStrip";
import { useDraft } from "@/hooks/use-draft";
import { actionChampionId, championFor } from "@/lib/draftView";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function DraftPicks({
  side,
  championsById,
  className,
}: {
  side: Side;
  championsById: ReadonlyMap<string, Champion>;
  className?: string;
}) {
  const { state, activeStep, selectStep, clearActive, assignRole } = useDraft();
  const suggested = new Set(suggestedSteps(state));
  const picks = sideTurns(state.format, side, "pick");
  const label = side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed;

  return (
    <section
      aria-label={`${label}の${ja.draft.pick}`}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-y-auto bg-card p-2",
        side === "blue" ? "border-l-4 border-side-blue" : "border-r-4 border-side-red",
        className,
      )}
    >
      <ol className="flex flex-1 flex-col gap-2">
        {picks.map((turn, index) => {
          const championId = actionChampionId(state, turn.step);
          return (
            <li key={turn.step} className="min-h-[4.5rem] min-w-0 flex-1">
              <PickStrip
                turn={turn}
                index={index + 1}
                champion={championFor(championsById, championId)}
                position={championId ? positionOfChampion(state, side, championId) : null}
                active={activeStep === turn.step}
                suggested={suggested.has(turn.step)}
                mirrored={side === "red"}
                onSelect={() => selectStep(turn.step)}
                onAssign={(position) => assignRole(turn.step, position)}
                onClear={clearActive}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
