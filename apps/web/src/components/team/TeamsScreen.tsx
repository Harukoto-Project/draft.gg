"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TeamDetail } from "@/components/team/TeamDetail";
import { TeamForm } from "@/components/team/TeamForm";
import { TeamList } from "@/components/team/TeamList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useSignIn } from "@/hooks/use-me";
import { useProfiles } from "@/hooks/use-profiles";
import { useCreateTeam, useTeams } from "@/hooks/use-teams";
import { teamErrorMessage } from "@/lib/teamErrors";
import ja from "@/messages/ja.json";

function Message({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-foreground">{children}</p>;
}

export function TeamsScreen() {
  const me = useMe();
  const signIn = useSignIn();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <div className="flex shrink-0 flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{ja.teams.title}</h1>
        <p className="text-xs text-muted-foreground">{ja.teams.description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        {me.isPending ? (
          <div className="p-3" aria-hidden="true">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : me.data && !me.data.loginEnabled ? (
          <Message>{ja.teams.loginDisabled}</Message>
        ) : !me.data?.user ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-foreground">{ja.teams.loginRequired}</p>
            <Button size="sm" disabled={signIn.isPending} onClick={() => signIn.mutate("/teams")}>
              <LogIn />
              {signIn.isError ? ja.auth.signInError : ja.auth.signIn}
            </Button>
          </div>
        ) : (
          <TeamsWorkspace />
        )}
      </div>
    </div>
  );
}

/** ログイン済みのときの、一覧と詳細 */
function TeamsWorkspace() {
  const teams = useTeams(true);
  const profiles = useProfiles(true);
  const create = useCreateTeam();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (teams.isPending || profiles.isPending) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if ((teams.isError && !teams.data) || (profiles.isError && !profiles.data)) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-foreground">{ja.teams.loadError}</p>
        <Button
          variant="outline"
          onClick={() => {
            void teams.refetch();
            void profiles.refetch();
          }}
        >
          {ja.teams.retry}
        </Button>
      </div>
    );
  }

  const profileList = profiles.data ?? [];
  if (profileList.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-foreground">{ja.teams.noProfiles}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/profiles">{ja.teams.goProfiles}</Link>
        </Button>
      </div>
    );
  }

  const list = teams.data ?? [];
  // 削除などで選んでいたチームが無くなったら、先頭を選ぶ
  const selected = list.find((team) => team.id === selectedId) ?? list[0] ?? null;
  const showCreate = creating || (list.length === 0 && !selected);

  return (
    <div className="flex flex-col gap-6 p-4 lg:flex-row">
      <div className="w-full shrink-0 lg:w-64">
        <TeamList
          teams={list}
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
          <TeamForm
            profiles={profileList}
            pending={create.isPending}
            serverError={create.isError ? teamErrorMessage(create.error) : null}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (team) => {
                  setSelectedId(team.id);
                  setCreating(false);
                },
              })
            }
            onCancel={list.length > 0 ? () => setCreating(false) : undefined}
          />
        ) : selected ? (
          <TeamDetail
            team={selected}
            profiles={profileList}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <Message>{ja.teams.noSelection}</Message>
        )}
      </div>
    </div>
  );
}
