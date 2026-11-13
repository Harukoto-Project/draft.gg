import type { Profile } from "@draftgg/shared";
import { Plus } from "lucide-react";

import { RoleIcon } from "@/components/role/RoleIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ja from "@/messages/ja.json";

export function ProfileList({
  profiles,
  selectedId,
  creating,
  onSelect,
  onAdd,
}: {
  profiles: readonly Profile[];
  selectedId: string | null;
  creating: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" aria-pressed={creating} onClick={onAdd}>
        <Plus />
        {ja.profiles.add}
      </Button>
      {profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">{ja.profiles.empty}</p>
      ) : (
        <ul aria-label={ja.profiles.listLabel} className="flex flex-col gap-1">
          {profiles.map((profile) => {
            const current = !creating && profile.id === selectedId;
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => onSelect(profile.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    current
                      ? "border-selection bg-selection/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{profile.displayName}</span>
                  <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                    {profile.roles.map((role) => (
                      <RoleIcon key={role} position={role} className="size-4 opacity-75" />
                    ))}
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
