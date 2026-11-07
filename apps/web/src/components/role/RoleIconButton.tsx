import { POSITION_LABELS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIcon } from "@/components/role/RoleIcon";
import { cn } from "@/lib/utils";

export function RoleIconButton({
  position,
  pressed,
  disabled,
  label,
  onClick,
  className,
}: {
  position: Position;
  pressed: boolean;
  disabled?: boolean;
  /** 読み上げ用の名前。同じ画面に同じロールのボタンが並ぶときに、対象を含めて渡す */
  label?: string;
  onClick: () => void;
  className?: string;
}) {
  const positionLabel = POSITION_LABELS[position];
  return (
    <button
      type="button"
      aria-label={label ?? positionLabel}
      title={positionLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group inline-flex size-6 shrink-0 cursor-pointer items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        pressed ? "border-gold bg-gold/20" : "border-border bg-background/60 hover:border-gold/60",
        className,
      )}
    >
      <RoleIcon
        position={position}
        className={cn(
          "size-5 transition-[filter,opacity]",
          pressed ? "" : "opacity-75 grayscale group-hover:opacity-100 group-hover:grayscale-0",
        )}
      />
    </button>
  );
}
