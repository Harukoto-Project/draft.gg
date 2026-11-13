import type { Position } from "@draftgg/shared";

export function RoleIcon({ position, className }: { position: Position; className?: string }) {
  return (
    <img
      src={`/roles/${position}.png`}
      alt=""
      width={72}
      height={72}
      aria-hidden="true"
      className={className ?? "size-5"}
    />
  );
}
