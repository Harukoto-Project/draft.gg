import type { Champion, DraftTurn } from "@draftgg/shared";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function DraftSlot({
  turn,
  index,
  champion,
  active,
  suggested,
  onSelect,
  className,
}: {
  turn: DraftTurn;
  index: number;
  champion: Champion | null;
  active: boolean;
  suggested: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const label = formatMessage(ja.draft.slotLabel, {
    side: turn.side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed,
    type: turn.type === "ban" ? ja.draft.ban : ja.draft.pick,
    index: String(index),
  });

  return (
    <button
      type="button"
      aria-label={champion ? `${label} ${champion.nameJa}` : label}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-sm border bg-background transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-foreground bg-neutral-200 dark:bg-neutral-600",
        !active && suggested && "border-neutral-500",
        !active && !suggested && "border-dashed border-neutral-300 dark:border-neutral-600",
        className,
      )}
    >
      {champion ? (
        <ChampionIcon champion={champion} />
      ) : (
        <span className="text-xs text-muted-foreground">{index}</span>
      )}
    </button>
  );
}
