import type { Champion, DraftTurn } from "@draftgg/shared";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function DraftSlot({
  turn,
  index,
  championId,
  champion,
  active,
  suggested,
  onSelect,
  className,
}: {
  turn: DraftTurn;
  index: number;
  /** 保存されているチャンピオンID。一覧が未取得で `champion` が無いときはIDを出す */
  championId: string | null;
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
      aria-label={champion || championId ? `${label} ${champion?.nameJa ?? championId}` : label}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xs bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-selection/15",
        className,
      )}
    >
      {champion ? (
        <>
          <span className={cn("absolute inset-0", turn.type === "ban" && "grayscale")}>
            <ChampionIcon champion={champion} />
          </span>
          {turn.type === "ban" ? (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="absolute inset-0 size-full text-side-red"
            >
              <line
                x1="0"
                y1="100"
                x2="100"
                y2="0"
                stroke="currentColor"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : null}
        </>
      ) : championId ? (
        <span className="px-0.5 text-center text-[10px] leading-tight break-all text-foreground">
          {championId}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{index}</span>
      )}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-xs",
          active && "border-2 border-selection",
          !active && suggested && "border",
          !active &&
            suggested &&
            (turn.side === "blue" ? "border-side-blue/70" : "border-side-red/70"),
        )}
      />
    </button>
  );
}
