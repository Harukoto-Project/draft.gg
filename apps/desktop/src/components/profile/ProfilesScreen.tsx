import { useState } from "react";

import { ProfileDetail } from "@/components/profile/ProfileDetail";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileList } from "@/components/profile/ProfileList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateProfile, useProfiles } from "@/hooks/use-profiles";
import { profileErrorMessage } from "@/lib/profileErrors";
import ja from "@/messages/ja.json";

function Message({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-foreground">{children}</p>;
}

export function ProfilesScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <div className="flex shrink-0 flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{ja.profiles.title}</h1>
        <p className="text-xs text-muted-foreground">{ja.profiles.description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <ProfilesWorkspace />
      </div>
    </div>
  );
}

/** 一覧と詳細 */
function ProfilesWorkspace() {
  const profiles = useProfiles();
  const create = useCreateProfile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (profiles.isPending) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (profiles.isError && !profiles.data) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-foreground">{ja.profiles.loadError}</p>
        <Button variant="outline" onClick={() => void profiles.refetch()}>
          {ja.profiles.retry}
        </Button>
      </div>
    );
  }

  const list = profiles.data ?? [];
  // 削除などで選んでいたプレイヤーが無くなったら、先頭を選ぶ
  const selected = list.find((profile) => profile.id === selectedId) ?? list[0] ?? null;
  const showCreate = creating || (list.length === 0 && !selected);

  return (
    <div className="flex flex-col gap-6 p-4 lg:flex-row">
      <div className="w-full shrink-0 lg:w-64">
        <ProfileList
          profiles={list}
          selectedId={selected?.id ?? null}
          creating={showCreate}
          onSelect={(id) => {
            setSelectedId(id);
            setCreating(false);
            create.reset();
          }}
          onAdd={() => {
            setCreating(true);
            create.reset();
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        {showCreate ? (
          <ProfileForm
            pending={create.isPending}
            serverError={create.isError ? profileErrorMessage(create.error) : null}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (profile) => {
                  setSelectedId(profile.id);
                  setCreating(false);
                },
              })
            }
            onCancel={list.length > 0 ? () => setCreating(false) : undefined}
          />
        ) : selected ? (
          <ProfileDetail profile={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <Message>{ja.profiles.noSelection}</Message>
        )}
      </div>
    </div>
  );
}
