import { POSITIONS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { RoleTextChip } from "@/components/role/RoleTextChip";
import ja from "@/messages/ja.json";

/** 提案の対象。ロールを選ぶとソロ向け、「チーム」だと味方の空きロールすべて */
export function MyRolePicker({
  value,
  disabled,
  onChange,
}: {
  value: Position | null;
  disabled?: boolean;
  onChange: (position: Position | null) => void;
}) {
  return (
    <div role="group" aria-label={ja.recommendation.myRole} className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">{ja.recommendation.myRole}</span>
      <RoleTextChip
        pressed={value === null}
        disabled={disabled}
        title={ja.recommendation.myRoleTeamHint}
        onClick={() => onChange(null)}
      >
        {ja.recommendation.myRoleTeam}
      </RoleTextChip>
      {POSITIONS.map((position) => (
        <RoleIconButton
          key={position}
          position={position}
          pressed={value === position}
          disabled={disabled}
          onClick={() => onChange(value === position ? null : position)}
        />
      ))}
    </div>
  );
}
