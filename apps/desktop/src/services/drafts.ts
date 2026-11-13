import { savedDraftSchema, savedDraftsResponseSchema } from "@draftgg/shared";
import type { SavedDraft, SavedDraftInput } from "@draftgg/shared";

import { callCommand } from "@/services/tauri";

/** 新しい順 */
export async function loadDrafts(): Promise<SavedDraft[]> {
  const drafts = await callCommand<unknown>("list_drafts");
  return savedDraftsResponseSchema.parse({ drafts }).drafts;
}

export async function saveDraft(input: SavedDraftInput): Promise<SavedDraft> {
  return savedDraftSchema.parse(await callCommand("save_draft", { input }));
}

export async function deleteDraft(id: string): Promise<void> {
  await callCommand("delete_draft", { id });
}
