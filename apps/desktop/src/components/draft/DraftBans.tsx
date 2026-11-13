import { sideTurns, suggestedSteps } from "@draftgg/shared";
import type { Champion, Side } from "@draftgg/shared";

import { DraftSlot } from "@/components/draft/DraftSlot";
import { useDraft } from "@/hooks/use-draft";
import { actionChampionId, championFor } from "@/lib/draftView";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/** 1 陣営の BAN 5 枠。見出し行の端に置けるよう、小さな正方形を 1 行に並べる */
export function DraftBans({
  side,
  championsById,
  className,
}: {
  side: Side;
  championsById: ReadonlyMap<string, Champion>;
  className?: string;
}) {
  const { state, activeStep, selectStep, clearActive } = useDraft();
  const suggested = new Set(suggestedSteps(state));
  const bans = sideTurns(state.format, side, "ban");
  const label = side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed;
  const activeAction = state.actions.find((action) => action.step === activeStep);
  const showClear =
    activeAction?.side === side && activeAction.type === "ban" && activeAction.championId !== null;

  return (
    <section
      aria-label={`${label}の${ja.draft.ban}`}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      <span className="text-xs text-muted-foreground">{ja.draft.ban}</span>
      <div className="flex gap-1">
        {bans.map((turn, index) => {
          const championId = actionChampionId(state, turn.step);
          return (
            <DraftSlot
              key={turn.step}
              turn={turn}
              index={index + 1}
              championId={championId}
              champion={championFor(championsById, championId)}
              active={activeStep === turn.step}
              suggested={suggested.has(turn.step)}
              onSelect={() => selectStep(turn.step)}
              className="size-8"
            />
          );
        })}
      </div>
      {showClear ? (
        <button
          type="button"
          onClick={clearActive}
          className="cursor-pointer rounded-md px-1.5 text-xs text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ja.draft.clear}
        </button>
      ) : null}
    </section>
  );
}
