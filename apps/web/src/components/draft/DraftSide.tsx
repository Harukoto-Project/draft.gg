"use client";

import { positionOfChampion, sideTurns, suggestedSteps } from "@draftgg/shared";
import type { Champion, Position, Side } from "@draftgg/shared";
import { POSITIONS, POSITION_LABELS } from "@draftgg/shared";

import { DraftSlot } from "@/components/draft/DraftSlot";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDraft } from "@/hooks/use-draft";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function DraftSide({
  side,
  championsById,
}: {
  side: Side;
  championsById: ReadonlyMap<string, Champion>;
}) {
  const { state, activeStep, selectStep, clearActive, assignRole } = useDraft();
  const suggested = new Set(suggestedSteps(state));
  const bans = sideTurns(state.format, side, "ban");
  const picks = sideTurns(state.format, side, "pick");
  const label = side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed;
  const activeAction = state.actions.find((action) => action.step === activeStep);
  const showBanClear =
    activeAction?.side === side && activeAction.type === "ban" && activeAction.championId !== null;

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-md border-l-4 bg-card p-3",
        side === "blue" ? "border-side-blue" : "border-side-red",
      )}
      aria-label={label}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        {label}
        {state.mySide === side ? (
          <span className="text-xs font-normal text-muted-foreground">{ja.draft.mine}</span>
        ) : null}
      </h2>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs text-muted-foreground">{ja.draft.ban}</h3>
        <div className="grid grid-cols-5 gap-1">
          {bans.map((turn, index) => (
            <DraftSlot
              key={turn.step}
              turn={turn}
              index={index + 1}
              champion={championFor(championsById, actionChampionId(state, turn.step))}
              active={activeStep === turn.step}
              suggested={suggested.has(turn.step)}
              onSelect={() => selectStep(turn.step)}
              className="w-full"
            />
          ))}
        </div>
        {showBanClear ? (
          <button
            type="button"
            onClick={clearActive}
            className="w-fit cursor-pointer text-xs text-foreground underline-offset-2 hover:underline"
          >
            {ja.draft.clear}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs text-muted-foreground">{ja.draft.pick}</h3>
        <ol className="flex flex-col gap-2">
          {picks.map((turn, index) => {
            const championId = actionChampionId(state, turn.step);
            const champion = championFor(championsById, championId);
            const position = championId ? positionOfChampion(state, side, championId) : null;
            return (
              <li key={turn.step} className="flex min-w-0 items-start gap-2">
                <DraftSlot
                  turn={turn}
                  index={index + 1}
                  champion={champion}
                  active={activeStep === turn.step}
                  suggested={suggested.has(turn.step)}
                  onSelect={() => selectStep(turn.step)}
                  className="size-10 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm text-foreground">{champion?.nameJa ?? ""}</p>
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
      </div>
    </section>
  );
}

function actionChampionId(
  state: { actions: { step: number; championId: string | null }[] },
  step: number,
): string | null {
  return state.actions.find((action) => action.step === step)?.championId ?? null;
}

function championFor(
  championsById: ReadonlyMap<string, Champion>,
  championId: string | null,
): Champion | null {
  if (!championId) return null;
  return championsById.get(championId) ?? null;
}
