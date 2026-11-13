import { sideTurns, suggestedSteps } from "@draftgg/shared";
import type { Champion, Side } from "@draftgg/shared";

import { DraftSlot } from "@/components/draft/DraftSlot";
import { useDraft } from "@/hooks/use-draft";
import { actionChampionId, championFor } from "@/lib/draftView";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

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
      className={cn(
        "flex min-w-0 flex-col gap-2 border-t-4 bg-card p-3",
        side === "blue" ? "border-side-blue" : "border-side-red",
        className,
      )}
    >
      <h2
        className={cn(
          "flex items-baseline gap-2 text-base font-semibold text-foreground",
          side === "red" && "flex-row-reverse",
        )}
      >
        {label}
        {state.mySide === side ? (
          <span className="text-xs font-normal text-muted-foreground">{ja.draft.mine}</span>
        ) : null}
        <span className="text-xs font-normal text-muted-foreground">{ja.draft.ban}</span>
      </h2>
      <div className="grid grid-cols-5 gap-1">
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
              className="w-full"
            />
          );
        })}
      </div>
      {showClear ? (
        <button
          type="button"
          onClick={clearActive}
          className={cn(
            "w-fit cursor-pointer text-xs text-foreground underline-offset-2 hover:underline",
            side === "red" && "self-end",
          )}
        >
          {ja.draft.clear}
        </button>
      ) : null}
    </section>
  );
}
