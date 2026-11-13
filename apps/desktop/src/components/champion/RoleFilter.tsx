import { POSITIONS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { RoleTextChip } from "@/components/role/RoleTextChip";
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
      <RoleTextChip pressed={value === "all"} onClick={() => onChange("all")}>
        {ja.draft.roleAll}
      </RoleTextChip>
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
