import { POSITION_LABELS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIcon } from "@/components/role/RoleIcon";
import { cn } from "@/lib/utils";

export function RoleIconButton({
  position,
  pressed,
  disabled,
  onClick,
  className,
}: {
  position: Position;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const label = POSITION_LABELS[position];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        pressed
          ? "border-gold bg-gold text-background"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <RoleIcon position={position} className="size-4" />
    </button>
  );
}
