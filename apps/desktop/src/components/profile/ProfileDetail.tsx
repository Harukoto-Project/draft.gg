import type { Profile } from "@draftgg/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { PoolEditor } from "@/components/profile/PoolEditor";
import { ProfileForm } from "@/components/profile/ProfileForm";
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
import { useDeleteProfile, useUpdateProfile } from "@/hooks/use-profiles";
import { formatMessage } from "@/lib/formatMessage";
import { profileErrorMessage } from "@/lib/profileErrors";
import ja from "@/messages/ja.json";

/** 選んだプレイヤーの情報の編集・削除と、プールの編集 */
export function ProfileDetail({ profile, onDeleted }: { profile: Profile; onDeleted: () => void }) {
  const update = useUpdateProfile();
  const remove = useDeleteProfile();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <ProfileForm
          // プレイヤーを切り替えたときに、入力欄を作り直す
          key={`${profile.id}:${profile.displayName}:${profile.riotId}:${profile.region}:${profile.roles.join()}`}
          profile={profile}
          pending={update.isPending}
          serverError={update.isError ? profileErrorMessage(update.error) : null}
          onSubmit={(input) => update.mutate({ id: profile.id, patch: input })}
        />
        <div>
          <Button
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
            {ja.profiles.form.delete}
          </Button>
          {remove.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {profileErrorMessage(remove.error)}
            </p>
          ) : null}
        </div>
      </div>

      <PoolEditor profile={profile} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ja.profiles.form.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(ja.profiles.form.deleteDescription, { name: profile.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ja.profiles.form.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(profile.id, { onSuccess: onDeleted })}>
              {ja.profiles.form.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
