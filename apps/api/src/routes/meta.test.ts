import { metaResponseSchema } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createMetaRoute } from "./meta.js";
import type { MetaSource } from "./meta.js";

const source: MetaSource = {
  getSnapshot: () => ({
    patch: "16.22",
    tier: "diamond_plus",
    champions: [
      { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: "ap" },
    ],
    meta: [
      {
        championId: "Ahri",
        position: "mid",
        games: 1000,
        winRate: 0.51,
        pickRate: 0.1,
        banRate: 0.03,
        roleRate: 0.9,
        tierRank: 1,
      },
      {
        championId: "Ahri",
        position: "support",
        games: 100,
        winRate: 0.48,
        pickRate: 0.01,
        banRate: 0.03,
        roleRate: 0.05,
        tierRank: 5,
      },
    ],
    matchups: [],
    synergies: [],
  }),
};

describe("GET /meta", () => {
  it("ロールを指定すると、その統計だけを返す", async () => {
    const app = new Hono().route("/meta", createMetaRoute(source));
    const response = await app.request("/meta?position=mid");
    const body = metaResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(body.stats).toEqual([
      expect.objectContaining({
        championId: "Ahri",
        nameJa: "アーリ",
        position: "mid",
        tierRank: 1,
      }),
    ]);
  });

  it("ロール未指定でも、主要ロール(ロール割合が下限以上)の行だけを返す", async () => {
    const app = new Hono().route("/meta", createMetaRoute(source));
    const response = await app.request("/meta");
    const body = metaResponseSchema.parse(await response.json());

    expect(body.stats.map((row) => row.position)).toEqual(["mid"]);
  });

  it("未知のロールは 400 を返す", async () => {
    const app = new Hono().route("/meta", createMetaRoute(source));
    const response = await app.request("/meta?position=middle");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });
});
