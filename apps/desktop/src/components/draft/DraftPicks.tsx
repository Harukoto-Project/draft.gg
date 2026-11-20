import { positionOfChampion, sideTurns, suggestedSteps } from "@draftgg/shared";
import type { Champion, Side } from "@draftgg/shared";

import { PickCard } from "@/components/draft/PickCard";
import { useDraft } from "@/hooks/use-draft";
import { actionChampionId, championFor } from "@/lib/draftView";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/** 1 陣営のピック 5 枠を横一列に並べる。どちらの陣営も、左から 1 手目、2 手目…の順 */
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
    <section aria-label={`${label}の${ja.draft.pick}`} className={cn("min-w-0", className)}>
      <ol className="grid h-[clamp(7.5rem,24vh,12rem)] grid-cols-5 gap-2">
        {picks.map((turn, index) => {
          const championId = actionChampionId(state, turn.step);
          return (
            <li key={turn.step} className="min-h-0 min-w-0">
              <PickCard
                turn={turn}
                index={index + 1}
                championId={championId}
                champion={championFor(championsById, championId)}
                position={championId ? positionOfChampion(state, side, championId) : null}
                active={activeStep === turn.step}
                suggested={suggested.has(turn.step)}
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
