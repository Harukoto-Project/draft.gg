import { z } from "zod";

import { POSITIONS } from "./position.js";

export const DRAFT_FORMATS = ["ranked", "tournament"] as const;

export type DraftFormat = (typeof DRAFT_FORMATS)[number];

export const SIDES = ["blue", "red"] as const;

export type Side = (typeof SIDES)[number];

export const assignmentSchema = z.object({
  top: z.string().min(1).nullable(),
  jungle: z.string().min(1).nullable(),
  mid: z.string().min(1).nullable(),
  adc: z.string().min(1).nullable(),
  support: z.string().min(1).nullable(),
});

export type Assignment = z.infer<typeof assignmentSchema>;

export const draftActionSchema = z.object({
  step: z.number().int().nonnegative(),
  type: z.enum(["ban", "pick"]),
  side: z.enum(SIDES),
  championId: z.string().min(1).nullable(),
});

export const draftStateSchema = z
  .object({
    format: z.enum(DRAFT_FORMATS),
    mySide: z.enum(SIDES),
    actions: z.array(draftActionSchema),
    assignments: z.object({
      blue: assignmentSchema,
      red: assignmentSchema,
    }),
    me: z
      .object({
        side: z.enum(SIDES),
        position: z.enum(POSITIONS),
      })
      .optional(),
    /** チーム時のロールとプレイヤーの対応。M2 の計算では使わない。 */
    team: z
      .object({
        top: z.string().min(1).optional(),
        jungle: z.string().min(1).optional(),
        mid: z.string().min(1).optional(),
        adc: z.string().min(1).optional(),
        support: z.string().min(1).optional(),
      })
      .optional(),
  })
  .refine((draft) => draft.me === undefined || draft.me.side === draft.mySide, {
    path: ["me", "side"],
    message: "自分の陣営は mySide と揃えてください",
  });

export type DraftState = z.infer<typeof draftStateSchema>;
