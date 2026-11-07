"use client";

import { actionsMatchRules, draftHasChampion } from "@draftgg/shared";
import type { SavedDraft } from "@draftgg/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDraft } from "@/hooks/use-draft";
import { useDeleteDraft, useDrafts } from "@/hooks/use-drafts";
import { draftErrorMessage } from "@/lib/draftErrors";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function countActions(draft: SavedDraft) {
  let bans = 0;
  let picks = 0;
  for (const action of draft.state.actions) {
    if (action.championId === null) continue;
    if (action.type === "ban") bans += 1;
    else picks += 1;
  }
  return { bans, picks };
}

/** 保存したドラフトの一覧。読み込むと、いまのドラフトを置き換える(入力済みなら確認する) */
export function SavedDraftsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, loadDraft } = useDraft();
  const [pending, setPending] = useState<SavedDraft | null>(null);

  function load(draft: SavedDraft) {
    loadDraft(draft.state);
    setPending(null);
    onOpenChange(false);
  }
  const drafts = useDrafts(open);
  const remove = useDeleteDraft();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ja.drafts.savedTitle}</DialogTitle>
          <DialogDescription>{ja.drafts.savedDescription}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          {drafts.isPending ? (
            <div className="flex flex-col gap-2" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : drafts.isError && !drafts.data ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-foreground">{ja.drafts.loadError}</p>
              <Button variant="outline" size="sm" onClick={() => void drafts.refetch()}>
                {ja.drafts.retry}
              </Button>
            </div>
          ) : (drafts.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{ja.drafts.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {drafts.data?.map((draft) => {
                const label = DATE_FORMAT.format(new Date(draft.createdAt));
                const { bans, picks } = countActions(draft);
                const compatible = actionsMatchRules(draft.state);
                return (
                  <li key={draft.id} className="flex items-center gap-2 border border-border p-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-sm text-foreground">
                        {draft.note || ja.drafts.noNote}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {label}・{ja.drafts.format[draft.state.format]}・
                        {ja.drafts.side[draft.state.mySide]}・
                        {formatMessage(ja.drafts.summary, {
                          bans: String(bans),
                          picks: String(picks),
                        })}
                      </p>
                      {compatible ? null : (
                        <p className="truncate text-xs text-destructive">
                          {ja.drafts.incompatible}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!compatible}
                      onClick={() => (draftHasChampion(state) ? setPending(draft) : load(draft))}
                    >
                      {ja.drafts.load}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={formatMessage(ja.drafts.deleteLabel, { label })}
                      title={ja.drafts.delete}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(draft.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {remove.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {draftErrorMessage(remove.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ja.drafts.close}
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={pending !== null} onOpenChange={(next) => !next && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ja.drafts.loadConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ja.drafts.loadConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ja.draft.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) load(pending);
              }}
            >
              {ja.drafts.loadConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
