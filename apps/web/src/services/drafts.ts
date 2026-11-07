import { savedDraftSchema, savedDraftsResponseSchema } from "@draftgg/shared";
import type { SavedDraft, SavedDraftInput } from "@draftgg/shared";

import { jsonInit, request } from "@/services/http";

const BASE_PATH = "/api/me/drafts";

export async function loadDrafts(signal?: AbortSignal): Promise<SavedDraft[]> {
  const response = await request(BASE_PATH, { signal });
  return savedDraftsResponseSchema.parse(await response.json()).drafts;
}

export async function saveDraft(input: SavedDraftInput): Promise<SavedDraft> {
  const response = await request(BASE_PATH, jsonInit("POST", input));
  return savedDraftSchema.parse(await response.json());
}

export async function deleteDraft(id: string): Promise<void> {
  await request(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
