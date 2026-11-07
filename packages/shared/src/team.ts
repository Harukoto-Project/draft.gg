import { z } from "zod";

import { POSITIONS } from "./position.js";
import type { Position } from "./position.js";

/** 1ユーザーが持てるチーム数 */
export const MAX_TEAMS_PER_USER = 10;

/** ロールごとのプレイヤー ID。空きのロールは省く */
export type TeamMembers = Partial<Record<Position, string>>;

const profileIdSchema = z.uuid();

const membersSchema = z
  .object(
    Object.fromEntries(
      POSITIONS.map((position) => [position, profileIdSchema.optional()]),
    ) as Record<Position, z.ZodOptional<typeof profileIdSchema>>,
  )
  .strict()
  .refine(
    (members) => {
      const ids = Object.values(members);
      return new Set(ids).size === ids.length;
    },
    { message: "同じプレイヤーを複数のロールに割り当てられません" },
  );

/** チームの作成・更新で受け取る項目(更新は一部だけでもよい) */
export const teamInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  members: membersSchema,
});

export type TeamInput = z.infer<typeof teamInputSchema>;

export const teamPatchSchema = teamInputSchema.partial();

export type TeamPatch = z.infer<typeof teamPatchSchema>;

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: membersSchema,
});

export type Team = z.infer<typeof teamSchema>;

export const teamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});

export type TeamsResponse = z.infer<typeof teamsResponseSchema>;
