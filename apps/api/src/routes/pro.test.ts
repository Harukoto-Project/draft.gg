import { proChampionsResponseSchema } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createProRoute } from "./pro.js";
import type { ProReader } from "./pro.js";

describe("GET /pro/champions", () => {
  it("リーグとパッチで絞った統計を返す", async () => {
    const load = vi.fn<ProReader["load"]>(async () => ({
      scope: "league:LCK:patch:16.22",
      patches: ["16.22"],
      stats: [
        {
          championId: "Ahri",
          nameJa: "アーリ",
          position: "mid",
          games: 40,
          picks: 12,
          bans: 8,
          presence: 0.5,
          winRate: 0.58,
          earlyPickRate: 0.25,
        },
      ],
    }));
    const app = new Hono().route("/pro", createProRoute({ load }));
    const response = await app.request("/pro/champions?league=LCK&patch=16.22");
    const body = proChampionsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(load).toHaveBeenCalledWith({ league: "LCK", patch: "16.22" });
    expect(body.stats[0]?.nameJa).toBe("アーリ");
  });

  it("0埋めのパッチは保存時の表記にそろえる", async () => {
    const load = vi.fn<ProReader["load"]>(async () => ({
      scope: "patch:16.1",
      patches: ["16.1"],
      stats: [],
    }));
    const app = new Hono().route("/pro", createProRoute({ load }));
    const response = await app.request("/pro/champions?patch=16.01");

    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledWith({ patch: "16.1" });
  });

  it("リーグ名が対象外なら400を返す", async () => {
    const app = new Hono().route(
      "/pro",
      createProRoute({
        load: async () => {
          throw new Error("呼ばない");
        },
      }),
    );
    const response = await app.request("/pro/champions?league=LCS");
    expect(response.status).toBe(400);
  });

  it("解釈できないパッチは400を返す", async () => {
    const load = vi.fn<ProReader["load"]>();
    const app = new Hono().route("/pro", createProRoute({ load }));
    const response = await app.request("/pro/champions?patch=16.01a");
    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
});
