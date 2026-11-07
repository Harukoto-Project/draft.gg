import {
  ID_MAX_LENGTH,
  MAX_DRAFT_ACTIONS,
  MAX_POOL_ENTRIES,
  recommendationResponseSchema,
} from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { MAX_RECOMMENDATION_BODY_BYTES, createRecommendationsRoute } from "./recommendations.js";
import type { RecommendationSource } from "./recommendations.js";

function createApp(source: RecommendationSource) {
  return new Hono().route("/recommendations", createRecommendationsRoute(source));
}

const source: RecommendationSource = {
  getSnapshot: () => ({
    patch: "16.22",
    tier: "diamond_plus",
    champions: [
      { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: "ap" },
      { id: "Veigar", nameJa: "ベイガー", nameEn: "Veigar", numericKey: 45, damageType: "ap" },
    ],
    meta: [
      {
        championId: "Ahri",
        position: "mid",
        games: 10_000,
        winRate: 0.55,
        pickRate: 0.1,
        banRate: 0.04,
        roleRate: 0.9,
        tierRank: 1,
      },
      {
        championId: "Veigar",
        position: "mid",
        games: 10_000,
        winRate: 0.48,
        pickRate: 0.04,
        banRate: 0.01,
        roleRate: 0.8,
        tierRank: 5,
      },
    ],
    matchups: [],
    synergies: [],
    pro: [],
  }),
};

const draft = {
  format: "ranked",
  mySide: "blue",
  actions: [],
  assignments: {
    blue: { top: null, jungle: null, mid: null, adc: null, support: null },
    red: { top: null, jungle: null, mid: null, adc: null, support: null },
  },
  me: { side: "blue", position: "mid" },
};

describe("POST /recommendations", () => {
  it("ピック候補をスコア順に返す", async () => {
    const response = await createApp(source).request("/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft }),
    });
    const body = recommendationResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.picks[0]?.candidates.map((candidate) => candidate.championId)).toEqual([
      "Ahri",
      "Veigar",
    ]);
    expect(body.picks[0]?.candidates[0]?.reasons[0]).toContain("勝率55.0%");
  });

  async function post(body: unknown) {
    return createApp(source).request("/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("手数が上限(20)を超えるドラフトは 400 を返す", async () => {
    const actions = Array.from({ length: MAX_DRAFT_ACTIONS + 1 }, (_, step) => ({
      step,
      type: "ban",
      side: "blue",
      championId: null,
    }));

    const response = await post({ draft: { ...draft, actions } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  it("チャンピオンIDが長すぎるときは 400 を返す", async () => {
    const response = await post({
      draft: {
        ...draft,
        actions: [{ step: 0, type: "ban", side: "red", championId: "A".repeat(ID_MAX_LENGTH + 1) }],
      },
    });

    expect(response.status).toBe(400);
  });

  it("プールを渡すと、そのロールの候補にプールの要素が付く", async () => {
    const response = await post({
      draft,
      pools: { mid: [{ championId: "Veigar", games: 60, winRate: 0.6 }] },
    });
    const body = recommendationResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    const candidates = body.picks[0]?.candidates ?? [];
    expect(candidates.find((candidate) => candidate.championId === "Veigar")?.factors.pool).toBe(1);
    expect(candidates.find((candidate) => candidate.championId === "Ahri")?.factors.pool).toBe(0);
  });

  it("プールの形が違う(件数超過・勝率が範囲外)ときは 400 を返す", async () => {
    const tooMany = Array.from({ length: MAX_POOL_ENTRIES + 1 }, () => ({
      championId: "Ahri",
      games: 1,
      winRate: 0.5,
    }));

    expect((await post({ draft, pools: { mid: tooMany } })).status).toBe(400);
    expect(
      (await post({ draft, pools: { mid: [{ championId: "Ahri", games: 1, winRate: 2 }] } }))
        .status,
    ).toBe(400);
  });

  it("ボディが大きすぎるときは 413 を返す", async () => {
    const response = await post({ draft, padding: "x".repeat(MAX_RECOMMENDATION_BODY_BYTES) });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "payload_too_large" });
  });

  it("ドラフトの形が違うときは 400 を返す", async () => {
    const response = await createApp(source).request("/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft: {} }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });
});
