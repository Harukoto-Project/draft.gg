import { useRef } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import { INSPECTOR_MAX_WIDTH, INSPECTOR_MIN_WIDTH } from "@/services/inspector-layout-storage";
import ja from "@/messages/ja.json";

const KEY_STEP = 16;
/** チャンピオン一覧に最低限残す幅(px) */
const MIN_LIST_WIDTH = 320;

/**
 * チャンピオン一覧と推薦パネルの間の境界線。
 * ドラッグまたは矢印キーで推薦パネルの幅を変え、ダブルクリックか Enter で閉じる。
 * 推薦パネルは右側にあるので、左へ動かすと広がる。
 */
export function InspectorSplitter({
  width,
  containerRef,
  onWidthChange,
  onCollapse,
}: {
  width: number;
  containerRef: RefObject<HTMLElement | null>;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number; max: number } | null>(null);

  function maxWidth(): number {
    const total = containerRef.current?.getBoundingClientRect().width ?? Infinity;
    return Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, total - MIN_LIST_WIDTH));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, max: maxWidth() };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    onWidthChange(Math.min(state.max, state.startWidth - (event.clientX - state.startX)));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onWidthChange(Math.min(maxWidth(), width + KEY_STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onWidthChange(width - KEY_STEP);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onCollapse();
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ja.recommendation.resize}
      aria-valuenow={width}
      aria-valuemin={INSPECTOR_MIN_WIDTH}
      aria-valuemax={INSPECTOR_MAX_WIDTH}
      tabIndex={0}
      title={ja.recommendation.resizeHint}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onCollapse}
      onKeyDown={onKeyDown}
      className="group relative hidden cursor-col-resize touch-none outline-none xl:block"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:w-0.5 group-hover:bg-gold/70 group-focus-visible:w-0.5 group-focus-visible:bg-gold group-active:w-0.5 group-active:bg-gold"
      />
    </div>
  );
}
