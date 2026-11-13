import type { Profile } from "@draftgg/shared";
import { useId } from "react";

import ja from "@/messages/ja.json";

/** 自分のプレイヤーを選ぶ。選ぶと、そのプールを提案に使う */
export function PlayerPicker({
  profiles,
  value,
  onChange,
}: {
  profiles: readonly Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {ja.recommendation.player}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        className="h-7 max-w-48 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{ja.recommendation.playerNone}</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
