import { POSITIONS, POSITION_LABELS } from "@draftgg/shared";
import type { Champion, DraftTurn, Position } from "@draftgg/shared";

import { PickSplash } from "@/components/draft/PickSplash";
import { RoleIconButton } from "@/components/role/RoleIconButton";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/** 大会配信風の、スプラッシュ画像を敷いたピック枠 */
export function PickStrip({
  turn,
  index,
  championId,
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
  /** 保存されているチャンピオンID。一覧が未取得で `champion` が無いときも枠を埋めて見せる */
  championId: string | null;
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

  const filled = championId !== null;
  const name = champion ? champion.nameJa : championId;

  return (
    <div
      className={cn(
        "relative h-full min-h-[4.5rem] min-w-0 overflow-hidden border bg-background",
        active && "border-gold",
        !active && suggested && "border-dashed",
        !active && suggested && (turn.side === "blue" ? "border-side-blue" : "border-side-red"),
        !active && !suggested && !filled && "border-dashed border-border",
        !active && !suggested && filled && "border-border",
      )}
    >
      {champion ? (
        <>
          <PickSplash key={champion.id} champion={champion} />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/10" />
        </>
      ) : (
        <div className={cn("absolute inset-0", active && "bg-gold/15")} />
      )}
      {active ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border-[3px] border-gold"
        />
      ) : null}
      <button
        type="button"
        aria-label={name ? `${label} ${name}` : label}
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
              champion ? "text-white" : filled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {name ?? `${ja.draft.pick} ${index}`}
          </p>
          {active && filled ? (
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
              disabled={!filled}
              label={formatMessage(ja.draft.assignRole, {
                slot: label,
                champion: name ?? "",
                role: POSITION_LABELS[item],
              })}
              onClick={() => onAssign(position === item ? null : item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
