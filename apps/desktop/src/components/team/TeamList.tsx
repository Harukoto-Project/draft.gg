import type { Team } from "@draftgg/shared";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function TeamList({
  teams,
  selectedId,
  creating,
  onSelect,
  onAdd,
}: {
  teams: readonly Team[];
  selectedId: string | null;
  creating: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" aria-pressed={creating} onClick={onAdd}>
        <Plus />
        {ja.teams.add}
      </Button>
      {teams.length === 0 ? (
        <p className="text-xs text-muted-foreground">{ja.teams.empty}</p>
      ) : (
        <ul aria-label={ja.teams.listLabel} className="flex flex-col gap-1">
          {teams.map((team) => {
            const current = !creating && team.id === selectedId;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => onSelect(team.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "border-selection bg-selection/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {Object.keys(team.members).length}/5
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
