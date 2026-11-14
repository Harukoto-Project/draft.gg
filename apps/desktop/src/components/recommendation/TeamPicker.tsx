import type { Team } from "@draftgg/shared";
import { useId } from "react";

import ja from "@/messages/ja.json";

/** チームを選ぶ。選ぶと、割り当てたプレイヤーのプールを提案に使う */
export function TeamPicker({
  teams,
  value,
  onChange,
}: {
  teams: readonly Team[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {ja.recommendation.team}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        className="h-7 max-w-48 rounded-sm border border-input bg-background px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{ja.recommendation.teamNone}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );
}
