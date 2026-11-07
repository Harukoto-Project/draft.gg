import type { ChampionRef, ProGameDraft } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { createProAggregateJob } from "./pro-aggregate.js";
import { createProLeaguepediaJob } from "./pro-leaguepedia.js";
import { createProOraclesJob } from "./pro-oracles.js";

const champion = (id: string): ChampionRef => ({
  id,
  nameJa: id,
  nameEn: id,
  numericKey: 1,
  damageType: null,
});

describe("createProOraclesJob", () => {
  it("チャンピオンマスタが足りないときは取得しない", async () => {
    const fetchGames = vi.fn();
    await expect(
      createProOraclesJob({
        listChampions: async () => [champion("Ahri")],
        fetchGames,
        save: async () => {},
      }).run(),
    ).rejects.toThrow("最低件数");
    expect(fetchGames).not.toHaveBeenCalled();
  });
});

describe("createProLeaguepediaJob", () => {
  it("認証情報が無いときは取得せず成功にする", async () => {
    const fetchDrafts = vi.fn();
    const summary = await createProLeaguepediaJob({
      credentials: null,
      listChampions: async () => [],
      listGames: async () => [],
      fetchDrafts,
      fillOrders: async () => 0,
    }).run();

    expect(summary).toEqual({ skipped: true });
    expect(fetchDrafts).not.toHaveBeenCalled();
  });

  it("順番が全部入っているときは取得しない", async () => {
    const fetchDrafts = vi.fn();
    const summary = await createProLeaguepediaJob({
      credentials: { username: "bot", password: "secret" },
      listChampions: async () => [],
      listGames: async () => [game(1, "2026-03-01")],
      fetchDrafts,
      fillOrders: async () => 0,
    }).run();

    expect(summary).toEqual({ skipped: true, reason: "orders filled" });
    expect(fetchDrafts).not.toHaveBeenCalled();
  });

  it("順番が空の試合の日付だけを渡す", async () => {
    const fetchDrafts = vi.fn(async () => []);
    await createProLeaguepediaJob({
      credentials: { username: "bot", password: "secret" },
      listChampions: async () => [],
      listGames: async () => [
        game(1, "2026-03-02", "filled"),
        game(null, "2026-03-01", "a"),
        game(null, "2026-03-01", "b"),
        game(null, "2026-01-15", "c"),
      ],
      fetchDrafts,
      fillOrders: async () => 0,
    }).run();

    expect(fetchDrafts).toHaveBeenCalledWith(["2026-01-15", "2026-03-01"], undefined);
  });
});

function game(order: number | null, playedAt: string, gameKey = playedAt): ProGameDraft {
  return {
    gameKey,
    league: "LCK",
    event: "Spring",
    playedAt: new Date(`${playedAt}T00:00:00.000Z`),
    gameNumber: "1",
    patch: "16.1",
    blueTeam: "T1",
    redTeam: "Gen.G",
    winnerSide: "blue",
    actions: [{ side: "blue", type: "pick", order, position: "mid", championId: "Ahri" }],
  };
}

describe("createProAggregateJob", () => {
  it("集計結果が空なら保存しない", async () => {
    const save = vi.fn(async () => {});
    await expect(
      createProAggregateJob({
        listGames: async () => [],
        save,
      }).run(),
    ).rejects.toThrow("前回の統計を残します");
    expect(save).not.toHaveBeenCalled();
  });
});
