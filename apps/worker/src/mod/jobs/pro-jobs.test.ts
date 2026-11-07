import type { ChampionRef } from "@draftgg/shared";
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
});

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
