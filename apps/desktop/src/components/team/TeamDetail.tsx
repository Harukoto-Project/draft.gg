import type { Profile, Team } from "@draftgg/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { TeamForm } from "@/components/team/TeamForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTeam, useUpdateTeam } from "@/hooks/use-teams";
import { formatMessage } from "@/lib/formatMessage";
import { teamErrorMessage } from "@/lib/teamErrors";
import ja from "@/messages/ja.json";

/** 選んだチームの編集と削除 */
export function TeamDetail({
  team,
  profiles,
  onDeleted,
}: {
  team: Team;
  profiles: readonly Profile[];
  onDeleted: () => void;
}) {
  const update = useUpdateTeam();
  const remove = useDeleteTeam();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <TeamForm
        // チームを切り替えたときに、入力欄を作り直す
        key={`${team.id}:${team.name}:${JSON.stringify(team.members)}`}
        team={team}
        profiles={profiles}
        pending={update.isPending}
        serverError={update.isError ? teamErrorMessage(update.error) : null}
        onSubmit={(input) => update.mutate({ id: team.id, patch: input })}
      />
      <div>
        <Button
          variant="destructive"
          size="sm"
          disabled={remove.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 />
          {ja.teams.form.delete}
        </Button>
        {remove.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {teamErrorMessage(remove.error)}
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ja.teams.form.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(ja.teams.form.deleteDescription, { name: team.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ja.teams.form.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(team.id, { onSuccess: onDeleted })}>
              {ja.teams.form.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
