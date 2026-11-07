"use client";

import {
  POSITIONS,
  POSITION_LABELS,
  positionOfChampion,
  sideTurns,
  suggestedSteps,
} from "@draftgg/shared";
import type { Champion, Position, Side } from "@draftgg/shared";

import { DraftSlot } from "@/components/draft/DraftSlot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const mirrored = side === "red";

  return (
    <section
      aria-label={`${label}の${ja.draft.pick}`}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-y-auto bg-card p-3",
        side === "blue" ? "border-l-4 border-side-blue" : "border-r-4 border-side-red",
        className,
      )}
    >
      <ol className="flex flex-1 flex-col justify-between gap-2">
        {picks.map((turn, index) => {
          const championId = actionChampionId(state, turn.step);
          const champion = championFor(championsById, championId);
          const position = championId ? positionOfChampion(state, side, championId) : null;
          return (
            <li
              key={turn.step}
              className={cn("flex min-w-0 items-center gap-2", mirrored && "flex-row-reverse")}
            >
              <DraftSlot
                turn={turn}
                index={index + 1}
                champion={champion}
                active={activeStep === turn.step}
                suggested={suggested.has(turn.step)}
                onSelect={() => selectStep(turn.step)}
                className="size-12 shrink-0 lg:size-16"
              />
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1",
                  mirrored && "items-end text-right",
                )}
              >
                <p className="w-full truncate text-sm font-medium text-foreground">
                  {champion?.nameJa ?? ""}
                </p>
                <Select
                  value={position ?? "unset"}
                  disabled={!championId}
                  onValueChange={(value) =>
                    assignRole(turn.step, value === "unset" ? null : (value as Position))
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={`${champion?.nameJa ?? label}の${ja.draft.role}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">{ja.draft.roleUnset}</SelectItem>
                    {POSITIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {POSITION_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeStep === turn.step && championId ? (
                  <button
                    type="button"
                    onClick={clearActive}
                    className="w-fit cursor-pointer text-xs text-foreground underline-offset-2 hover:underline"
                  >
                    {ja.draft.clear}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
