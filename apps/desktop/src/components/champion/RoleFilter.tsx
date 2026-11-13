import { POSITIONS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export type RoleFilterValue = Position | "all";

export function RoleFilter({
  value,
  onChange,
  disabled,
}: {
  value: RoleFilterValue;
  onChange: (value: RoleFilterValue) => void;
  /** ロール統計が未取得で絞り込めないとき */
  disabled: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ja.draft.roleFilter}
      title={disabled ? ja.draft.roleFilterUnavailable : undefined}
      className="flex shrink-0 items-center gap-1"
    >
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={cn(
          "h-6 shrink-0 cursor-pointer border px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          value === "all"
            ? "border-gold bg-gold/20 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {ja.draft.roleAll}
      </button>
      {POSITIONS.map((position) => (
        <RoleIconButton
          key={position}
          position={position}
          pressed={value === position}
          disabled={disabled}
          onClick={() => onChange(value === position ? "all" : position)}
        />
      ))}
    </div>
  );
}
