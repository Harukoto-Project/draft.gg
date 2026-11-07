import { z } from "zod";

import { draftStateSchema } from "./draft.js";

/** 1ユーザーが保存できるドラフト数 */
export const MAX_DRAFTS_PER_USER = 50;

export const DRAFT_NOTE_MAX_LENGTH = 200;

export const savedDraftInputSchema = z.object({
  state: draftStateSchema,
  note: z.string().trim().max(DRAFT_NOTE_MAX_LENGTH).default(""),
});

export type SavedDraftInput = z.input<typeof savedDraftInputSchema>;

export const savedDraftSchema = z.object({
  id: z.string(),
  state: draftStateSchema,
  note: z.string(),
  /** ISO 8601 */
  createdAt: z.string(),
});

export type SavedDraft = z.infer<typeof savedDraftSchema>;

export const savedDraftsResponseSchema = z.object({
  drafts: z.array(savedDraftSchema),
});

export type SavedDraftsResponse = z.infer<typeof savedDraftsResponseSchema>;
