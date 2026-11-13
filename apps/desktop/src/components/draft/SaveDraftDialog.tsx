import { DRAFT_NOTE_MAX_LENGTH } from "@draftgg/shared";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDraft } from "@/hooks/use-draft";
import { useSaveDraft } from "@/hooks/use-drafts";
import { draftErrorMessage } from "@/lib/draftErrors";
import ja from "@/messages/ja.json";

/** いまのドラフトに、メモを付けて保存する */
export function SaveDraftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useDraft();
  const save = useSaveDraft();
  const noteId = useId();
  const [note, setNote] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(
      { state, note },
      {
        onSuccess: () => {
          setNote("");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) save.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{ja.drafts.saveTitle}</DialogTitle>
            <DialogDescription>{ja.drafts.saveDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="text-xs text-muted-foreground">
              {ja.drafts.note}
            </label>
            <Input
              id={noteId}
              value={note}
              maxLength={DRAFT_NOTE_MAX_LENGTH}
              placeholder={ja.drafts.notePlaceholder}
              autoComplete="off"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {save.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {draftErrorMessage(save.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ja.drafts.cancel}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {ja.drafts.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
