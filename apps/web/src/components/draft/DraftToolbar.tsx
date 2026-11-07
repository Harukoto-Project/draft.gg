"use client";

import { draftHasChampion } from "@draftgg/shared";
import type { DraftFormat } from "@draftgg/shared";
import { useState } from "react";

import { SaveDraftDialog } from "@/components/draft/SaveDraftDialog";
import { SavedDraftsDialog } from "@/components/draft/SavedDraftsDialog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDraft } from "@/hooks/use-draft";
import { useMe } from "@/hooks/use-me";
import { formatMessage } from "@/lib/formatMessage";
import ja from "@/messages/ja.json";

export function DraftToolbar({ patch }: { patch: string | null }) {
  const { state, chooseFormat, chooseSide, reset } = useDraft();
  const [pendingFormat, setPendingFormat] = useState<DraftFormat | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const dirty = draftHasChampion(state);

  function requestFormat(value: string) {
    if (value !== "ranked" && value !== "tournament") return;
    if (value === state.format) return;
    if (dirty) {
      setPendingFormat(value);
      return;
    }
    chooseFormat(value);
  }

  return (
    <div className="flex shrink-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-xl font-semibold text-foreground">{ja.draft.title}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {patch ? formatMessage(ja.draft.patch, { version: patch }) : ja.draft.patchUnknown}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={state.format}
          aria-label={ja.draft.format}
          onValueChange={requestFormat}
        >
          <ToggleGroupItem value="ranked">{ja.draft.formatRanked}</ToggleGroupItem>
          <ToggleGroupItem value="tournament">{ja.draft.formatTournament}</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={0}
          value={state.mySide}
          aria-label={ja.draft.mySide}
          onValueChange={(value) => {
            if (value === "blue" || value === "red") chooseSide(value);
          }}
        >
          <ToggleGroupItem value="blue">{ja.draft.sideBlue}</ToggleGroupItem>
          <ToggleGroupItem value="red">{ja.draft.sideRed}</ToggleGroupItem>
        </ToggleGroup>
        {signedIn ? (
          <>
            <Button variant="outline" disabled={!dirty} onClick={() => setSaveOpen(true)}>
              {ja.drafts.save}
            </Button>
            <Button variant="outline" onClick={() => setSavedOpen(true)}>
              {ja.drafts.saved}
            </Button>
          </>
        ) : null}
        <Button variant="outline" disabled={!dirty} onClick={() => setResetOpen(true)}>
          {ja.draft.reset}
        </Button>
      </div>
      {signedIn ? (
        <>
          <SaveDraftDialog open={saveOpen} onOpenChange={setSaveOpen} />
          <SavedDraftsDialog open={savedOpen} onOpenChange={setSavedOpen} />
        </>
      ) : null}
      <AlertDialog
        open={pendingFormat !== null}
        onOpenChange={(open) => !open && setPendingFormat(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ja.draft.formatChangeTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ja.draft.formatChangeDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ja.draft.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingFormat) chooseFormat(pendingFormat);
                setPendingFormat(null);
              }}
            >
              {ja.draft.formatChangeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ja.draft.resetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ja.draft.resetDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ja.draft.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                reset();
                setResetOpen(false);
              }}
            >
              {ja.draft.resetConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
