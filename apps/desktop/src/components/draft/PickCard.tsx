import { POSITION_LABELS } from "@draftgg/shared";
import type { Champion, DraftTurn, Position } from "@draftgg/shared";

import { PickSplash } from "@/components/draft/PickSplash";
import { RoleAssignMenu } from "@/components/role/RoleAssignMenu";
import { formatMessage } from "@/lib/formatMessage";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/**
 * ピック 1 枠。スプラッシュ画像を縦長に敷いたカード。
 * 選択中はアクセント色の枠、次に埋める候補はチーム色の細い枠で示す。ロールは右上のメニューで選ぶ。
 */
export function PickCard({
  turn,
  index,
  championId,
  champion,
  position,
  active,
  suggested,
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
        "group relative h-full min-h-0 min-w-0 overflow-hidden rounded-xs border bg-muted transition-colors",
        active && "border-selection ring-2 ring-selection",
        !active &&
          suggested &&
          (turn.side === "blue" ? "border-side-blue/70" : "border-side-red/70"),
        !filled && !active && !suggested && "border-dashed",
      )}
    >
      {champion ? (
        <>
          <PickSplash key={champion.id} champion={champion} />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/20" />
        </>
      ) : null}
      <button
        type="button"
        aria-label={name ? `${label} ${name}` : label}
        aria-pressed={active}
        onClick={onSelect}
        className="absolute inset-0 cursor-pointer rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative flex h-full flex-col justify-between p-1.5">
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-medium text-white/80 tabular-nums">
            {champion ? index : null}
          </span>
          <RoleAssignMenu
            position={position}
            disabled={!filled}
            label={formatMessage(ja.draft.roleMenu, { slot: name ? `${label} ${name}` : label })}
            onChange={onAssign}
            className="pointer-events-auto"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p
            className={cn(
              "truncate text-sm font-semibold",
              champion ? "text-white" : filled ? "text-foreground" : "text-muted-foreground",
            )}
            title={position ? `${name ?? ""} · ${POSITION_LABELS[position]}` : (name ?? undefined)}
          >
            {name ?? formatMessage(ja.draft.emptyPick, { index: String(index) })}
          </p>
          {active && filled ? (
            <button
              type="button"
              onClick={onClear}
              className="pointer-events-auto w-fit cursor-pointer rounded-xs bg-black/60 px-1.5 py-0.5 text-xs text-white outline-none hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ja.draft.clear}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
