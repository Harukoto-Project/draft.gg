import { POSITIONS } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";

import { RoleIconButton } from "@/components/role/RoleIconButton";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

/** 提案の対象。ロールを選ぶとソロ向け、「チーム」だと味方の空きロールすべて */
export function MyRolePicker({
  value,
  onChange,
}: {
  value: Position | null;
  onChange: (position: Position | null) => void;
}) {
  return (
    <div role="group" aria-label={ja.recommendation.myRole} className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">{ja.recommendation.myRole}</span>
      <button
        type="button"
        aria-pressed={value === null}
        title={ja.recommendation.myRoleTeamHint}
        onClick={() => onChange(null)}
        className={cn(
          "h-6 shrink-0 cursor-pointer border px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          value === null
            ? "border-gold bg-gold/20 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {ja.recommendation.myRoleTeam}
      </button>
      {POSITIONS.map((position) => (
        <RoleIconButton
          key={position}
          position={position}
          pressed={value === position}
          onClick={() => onChange(value === position ? null : position)}
        />
      ))}
    </div>
  );
}
