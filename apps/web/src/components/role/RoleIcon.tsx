import type { Position } from "@draftgg/shared";
import type { ReactNode } from "react";

const FRAME = (
  <rect
    x="3.5"
    y="3.5"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeOpacity="0.45"
    strokeWidth="1.5"
  />
);

const GLYPHS: Record<Position, ReactNode> = {
  top: (
    <>
      {FRAME}
      <path d="M5 5h10L5 15z" fill="currentColor" />
    </>
  ),
  jungle: <path d="M12 3l8 9-8 9-8-9zm0 5l-3.5 4 3.5 4 3.5-4z" fill="currentColor" />,
  mid: (
    <>
      {FRAME}
      <path d="M5 19L19 5" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </>
  ),
  adc: (
    <>
      {FRAME}
      <path d="M19 19H9l10-10z" fill="currentColor" />
    </>
  ),
  support: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill="currentColor" />,
};

export function RoleIcon({ position, className }: { position: Position; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? "size-4"}>
      {GLYPHS[position]}
    </svg>
  );
}
