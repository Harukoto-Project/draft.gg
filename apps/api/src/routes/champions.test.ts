import { championsResponseSchema } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createChampionsRoute } from "./champions.js";
import type { ChampionSource, ChampionsReader } from "./champions.js";

const ahri: ChampionSource = {
  id: "Ahri",
  numericKey: 103,
  nameJa: "アーリ",
  nameEn: "Ahri",
  tags: ["Mage", "Assassin"],
  damageType: null,
  imageVersion: "16.22.1",
};

function createApp(reader: ChampionsReader) {
  return new Hono().route("/champions", createChampionsRoute(reader));
}

describe("GET /champions", () => {
  it("現在のパッチとチャンピオン一覧を返す", async () => {
    const app = createApp({
      getCurrentPatch: async () => "16.22",
      listChampions: async () => [ahri],
    });

    const response = await app.request("/champions");
    const body = championsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({ patch: "16.22", champions: [ahri] });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("未取り込みの場合は patch を null、一覧を空で返す", async () => {
    const app = createApp({
      getCurrentPatch: async () => null,
      listChampions: async () => [],
    });

    const response = await app.request("/champions");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ patch: null, champions: [] });
  });
});
