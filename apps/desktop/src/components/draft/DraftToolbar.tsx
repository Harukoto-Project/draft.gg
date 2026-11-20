import { draftHasChampion } from "@draftgg/shared";
import type { DraftFormat } from "@draftgg/shared";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
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
import { useInspectorLayout } from "@/hooks/use-inspector-layout";

import ja from "@/messages/ja.json";

export function DraftToolbar() {
  const { state, chooseFormat, chooseSide, reset } = useDraft();
  const inspector = useInspectorLayout();
  const [pendingFormat, setPendingFormat] = useState<DraftFormat | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
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
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <h1 className="sr-only">{ja.draft.title}</h1>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ja.draft.format}</span>
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
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{ja.draft.mySide}</span>
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
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={inspector.open}
          onClick={inspector.toggle}
          className="hidden xl:inline-flex"
        >
          {inspector.open ? (
            <PanelRightClose aria-hidden="true" />
          ) : (
            <PanelRightOpen aria-hidden="true" />
          )}
          {ja.recommendation.panel}
        </Button>
        <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setSaveOpen(true)}>
          {ja.drafts.save}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSavedOpen(true)}>
          {ja.drafts.saved}
        </Button>
        <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setResetOpen(true)}>
          {ja.draft.reset}
        </Button>
      </div>

      <SaveDraftDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <SavedDraftsDialog open={savedOpen} onOpenChange={setSavedOpen} />
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
