import type { Champion, Side } from "@draftgg/shared";

import { DraftBans } from "@/components/draft/DraftBans";
import { DraftPicks } from "@/components/draft/DraftPicks";
import { useDraft } from "@/hooks/use-draft";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/**
 * 1 陣営の帯。上端のチーム色の線、見出し(陣営名と「自分」)、BAN、ピックの順に並べる。
 * 枠や背景は付けず、チーム色の線と余白で区切る。チーム色(青・赤)は、この線と見出しの印にだけ使う。
 */
export function DraftSide({
  side,
  championsById,
  className,
}: {
  side: Side;
  championsById: ReadonlyMap<string, Champion>;
  className?: string;
}) {
  const { state } = useDraft();
  const label = side === "blue" ? ja.draft.sideBlue : ja.draft.sideRed;
  const mine = state.mySide === side;

  return (
    <section
      data-side={side}
      className={cn(
        "min-w-0 border-t-2",
        side === "blue" ? "border-side-blue" : "border-side-red",
        className,
      )}
    >
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                side === "blue" ? "bg-side-blue" : "bg-side-red",
              )}
            />
            {label}
            {mine ? (
              <span className="text-xs font-normal text-muted-foreground">{ja.draft.mine}</span>
            ) : null}
          </h2>
          <DraftBans side={side} championsById={championsById} />
        </div>
        <DraftPicks side={side} championsById={championsById} />
      </div>
    </section>
  );
}
