import { z } from "zod";

import { POSITIONS } from "./position.js";

export const DRAFT_FORMATS = ["ranked", "tournament"] as const;

export type DraftFormat = (typeof DRAFT_FORMATS)[number];

export const SIDES = ["blue", "red"] as const;

export type Side = (typeof SIDES)[number];

/** ランク戦・大会形式のドラフトは最大 20 手(BAN 10 + ピック 10) */
export const MAX_DRAFT_ACTIONS = 20;

/** DB の varchar(64) に合わせる */
export const ID_MAX_LENGTH = 64;

const championIdSchema = z.string().min(1).max(ID_MAX_LENGTH);
/** プレイヤーを指す ID。M2 では中身を使わない */
const playerRefSchema = z.string().min(1).max(ID_MAX_LENGTH);

export const assignmentSchema = z.object({
  top: championIdSchema.nullable(),
  jungle: championIdSchema.nullable(),
  mid: championIdSchema.nullable(),
  adc: championIdSchema.nullable(),
  support: championIdSchema.nullable(),
});

export type Assignment = z.infer<typeof assignmentSchema>;

export const draftActionSchema = z.object({
  step: z.number().int().nonnegative(),
  type: z.enum(["ban", "pick"]),
  side: z.enum(SIDES),
  championId: championIdSchema.nullable(),
});

export const draftStateSchema = z
  .object({
    format: z.enum(DRAFT_FORMATS),
    mySide: z.enum(SIDES),
    actions: z.array(draftActionSchema).max(MAX_DRAFT_ACTIONS),
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
        top: playerRefSchema.optional(),
        jungle: playerRefSchema.optional(),
        mid: playerRefSchema.optional(),
        adc: playerRefSchema.optional(),
        support: playerRefSchema.optional(),
      })
      .optional(),
  })
  .refine((draft) => draft.me === undefined || draft.me.side === draft.mySide, {
    path: ["me", "side"],
    message: "自分の陣営は mySide と揃えてください",
  });

export type DraftState = z.infer<typeof draftStateSchema>;
