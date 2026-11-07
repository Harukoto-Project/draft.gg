import { recommend } from "@draftgg/engine";
import {
  BAN_WEIGHT_PRESETS,
  DEFAULT_RANK_TIER,
  DEFAULT_RECOMMENDATION_LIMIT,
  PICK_WEIGHT_PRESETS,
  recommendationRequestSchema,
  recommendationResponseSchema,
} from "@draftgg/shared";
import type { StatsSnapshot } from "@draftgg/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

export interface RecommendationSource {
  getSnapshot(): StatsSnapshot;
}

/** 20 手のドラフトと重みで 4KB 程度。余裕を見て 16KB までにする */
export const MAX_RECOMMENDATION_BODY_BYTES = 16 * 1024;

export function createRecommendationsRoute(source: RecommendationSource) {
  const limit = bodyLimit({
    maxSize: MAX_RECOMMENDATION_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  });

  return new Hono().post("/", limit, async (c) => {
    const json: unknown = await c.req.json().catch(() => null);
    const parsed = recommendationRequestSchema.safeParse(json);
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);

    const request = parsed.data;
    const snapshot = source.getSnapshot();
    const preset = request.preset ?? (request.draft.me ? "solo" : "team");
    const tier = request.tier ?? DEFAULT_RANK_TIER;
    const usable =
      snapshot.tier === tier
        ? snapshot
        : { ...snapshot, tier, meta: [], matchups: [], synergies: [] };

    const body = recommendationResponseSchema.parse(
      recommend({
        draft: request.draft,
        snapshot: usable,
        preset,
        limit: request.limit ?? DEFAULT_RECOMMENDATION_LIMIT,
        pickWeights: { ...PICK_WEIGHT_PRESETS[preset], ...request.weights?.pick },
        banWeights: { ...BAN_WEIGHT_PRESETS[preset], ...request.weights?.ban },
      }),
    );
    return c.json(body);
  });
}
