import type { Position } from "@draftgg/shared";
import Image from "next/image";

export function RoleIcon({ position, className }: { position: Position; className?: string }) {
  return (
    <Image
      src={`/roles/${position}.png`}
      alt=""
      width={72}
      height={72}
      aria-hidden="true"
      className={className ?? "size-5"}
    />
  );
}
