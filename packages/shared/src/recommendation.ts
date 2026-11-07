import { z } from "zod";

import { draftStateSchema, ID_MAX_LENGTH } from "./draft.js";
import { POSITIONS } from "./position.js";
import type { Position } from "./position.js";
import { MAX_POOL_ENTRIES } from "./profile.js";
import { RANK_TIERS } from "./tier.js";
import { PRESETS } from "./weights.js";

export const DEFAULT_RECOMMENDATION_LIMIT = 8;
export const MAX_RECOMMENDATION_LIMIT = 20;

const weight = z.number().min(0);

/** 提案に渡すプール 1 件。除外したものは送らない。手動登録は games と winRate が null。 */
export const poolHintEntrySchema = z.object({
  championId: z.string().min(1).max(ID_MAX_LENGTH),
  games: z.number().int().nonnegative().nullable(),
  winRate: z.number().min(0).max(1).nullable(),
});

export type PoolHintEntry = z.infer<typeof poolHintEntrySchema>;

/** ロールごとの、そのロールを担当するプレイヤーのプール */
export const poolHintsSchema = z
  .object(
    Object.fromEntries(
      POSITIONS.map((position) => [position, z.array(poolHintEntrySchema).max(MAX_POOL_ENTRIES)]),
    ) as Record<Position, z.ZodArray<typeof poolHintEntrySchema>>,
  )
  .partial();

export type PoolHints = z.infer<typeof poolHintsSchema>;

export const recommendationRequestSchema = z.object({
  draft: draftStateSchema,
  /** 渡したロールだけ、プールの要素を計算する。 */
  pools: poolHintsSchema.optional(),
  preset: z.enum(PRESETS).optional(),
  tier: z.enum(RANK_TIERS).optional(),
  limit: z.number().int().min(1).max(MAX_RECOMMENDATION_LIMIT).optional(),
  weights: z
    .object({
      pick: z
        .object({
          meta: weight,
          counter: weight,
          synergy: weight,
          pro: weight,
          pool: weight,
          composition: weight,
        })
        .partial()
        .optional(),
      ban: z
        .object({
          meta: weight,
          pro: weight,
          counter: weight,
        })
        .partial()
        .optional(),
    })
    .optional(),
});

export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;

export const recommendationCandidateSchema = z.object({
  championId: z.string(),
  nameJa: z.string(),
  /** BAN ではメタの強さを採ったロール。ピックでは所属するロール。 */
  position: z.enum(POSITIONS),
  score: z.number(),
  factors: z.object({
    meta: z.number().optional(),
    counter: z.number().optional(),
    synergy: z.number().optional(),
    pro: z.number().optional(),
    pool: z.number().optional(),
    composition: z.number().optional(),
  }),
  reasons: z.array(z.string()),
});

export type RecommendationCandidate = z.infer<typeof recommendationCandidateSchema>;

export const recommendationResponseSchema = z.object({
  patch: z.string().nullable(),
  tier: z.enum(RANK_TIERS),
  preset: z.enum(PRESETS),
  picks: z.array(
    z.object({
      position: z.enum(POSITIONS),
      candidates: z.array(recommendationCandidateSchema),
    }),
  ),
  bans: z.array(recommendationCandidateSchema),
});

export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;

export const metaQuerySchema = z.object({
  position: z.enum(POSITIONS).optional(),
  tier: z.enum(RANK_TIERS).optional(),
});

export const metaResponseSchema = z.object({
  patch: z.string().nullable(),
  tier: z.enum(RANK_TIERS),
  stats: z.array(
    z.object({
      championId: z.string(),
      nameJa: z.string(),
      position: z.enum(POSITIONS),
      games: z.number(),
      winRate: z.number(),
      pickRate: z.number(),
      banRate: z.number(),
      roleRate: z.number(),
      tierRank: z.number(),
    }),
  ),
});

export type MetaResponse = z.infer<typeof metaResponseSchema>;
