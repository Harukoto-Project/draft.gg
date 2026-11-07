import { POSITIONS } from "@draftgg/shared";
import type { Champion, DraftTurn, Position } from "@draftgg/shared";
import Image from "next/image";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";
import { championSplashUrl } from "@/services/champions";

/** 大会配信風の、スプラッシュ画像を敷いたピック枠 */
export function PickStrip({
  turn,
  index,
  champion,
  position,
  active,
  suggested,
  mirrored,
  onSelect,
  onAssign,
  onClear,
}: {
  turn: DraftTurn;
  index: number;
  champion: Champion | null;
  position: Position | null;
  active: boolean;
  suggested: boolean;
  mirrored: boolean;
  onSelect: () => void;
  onAssign: (position: Position | null) => void;
  onClear: () => void;
}) {
  const label = formatMessage(ja.draft.slotLabel, {
    side: turn.side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed,
    type: ja.draft.pick,
    index: String(index),
  });

  return (
    <div
      className={cn(
        "relative h-full min-h-[4.5rem] min-w-0 overflow-hidden border bg-background",
        active && "border-gold",
        !active && suggested && "border-gold/70",
        !active && !suggested && !champion && "border-dashed border-border",
        !active && !suggested && champion && "border-border",
      )}
    >
      {champion ? (
        <>
          <Image
            src={championSplashUrl(champion)}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, 50vw"
            className="object-cover object-[50%_25%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />
        </>
      ) : (
        <div className={cn("absolute inset-0", active && "bg-gold/15")} />
      )}
      <button
        type="button"
        aria-label={champion ? `${label} ${champion.nameJa}` : label}
        aria-pressed={active}
        onClick={onSelect}
        className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div
        className={cn(
          "pointer-events-none relative flex h-full flex-col justify-between gap-1 p-2",
          mirrored && "items-end text-right",
        )}
      >
        <div className={cn("flex w-full items-start gap-2", mirrored && "flex-row-reverse")}>
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              champion ? "text-white" : "text-muted-foreground",
            )}
          >
            {champion ? champion.nameJa : `${ja.draft.pick} ${index}`}
          </p>
          {active && champion ? (
            <button
              type="button"
              onClick={onClear}
              className="pointer-events-auto shrink-0 cursor-pointer bg-black/60 px-1.5 text-xs text-white underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ja.draft.clear}
            </button>
          ) : null}
        </div>
        <div className={cn("pointer-events-auto flex gap-1", mirrored && "justify-end")}>
          {POSITIONS.map((item) => (
            <RoleIconButton
              key={item}
              position={item}
              pressed={position === item}
              disabled={!champion}
              onClick={() => onAssign(position === item ? null : item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
