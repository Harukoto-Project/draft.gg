import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { extractToolJson, parseChampionAnalysis, parseLaneMeta } from "./parse.js";

const catalog: ChampionRef[] = [
  { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: null },
  { id: "Zed", nameJa: "ゼド", nameEn: "Zed", numericKey: 238, damageType: null },
  { id: "LeeSin", nameJa: "リー・シン", nameEn: "Lee Sin", numericKey: 64, damageType: null },
  { id: "Velkoz", nameJa: "ベルコズ", nameEn: "Vel'Koz", numericKey: 161, damageType: null },
];

describe("extractToolJson", () => {
  it("MCP の text から JSON を読む", () => {
    expect(extractToolJson({ content: [{ type: "text", text: '{"data":1}' }] })).toEqual({
      data: 1,
    });
  });

  it("本文が空なら失敗する", () => {
    expect(() => extractToolJson({ content: [] })).toThrow("本文がありません");
  });
});

describe("parseLaneMeta", () => {
  it("表示名をチャンピオンIDに対応付け、百分率は 0〜1 にする", () => {
    const rows = parseLaneMeta(
      {
        data: {
          positions: {
            mid: [
              {
                champion: "Ahri",
                play: 1000,
                win_rate: 0.51,
                pick_rate: 0.1,
                ban_rate: 0.03,
                role_rate: 0.95,
                tier: 1,
              },
              {
                champion: "Vel'Koz",
                play: 20,
                win_rate: 51,
                pick_rate: 2,
                ban_rate: 3,
                role_rate: 22,
                tier: 4,
              },
            ],
            TOP: [],
          },
        },
      },
      catalog,
    );

    expect(rows).toEqual([
      {
        championId: "Ahri",
        position: "mid",
        games: 1000,
        winRate: 0.51,
        pickRate: 0.1,
        banRate: 0.03,
        roleRate: 0.95,
        tierRank: 1,
      },
      {
        championId: "Velkoz",
        position: "mid",
        games: 20,
        winRate: 0.51,
        pickRate: 0.02,
        banRate: 0.03,
        roleRate: 0.22,
        tierRank: 4,
      },
    ]);
  });

  it("対応できない名前があれば保存前に失敗する", () => {
    expect(() =>
      parseLaneMeta(
        {
          data: {
            positions: {
              mid: [
                {
                  champion: "Unknown",
                  play: 1,
                  win_rate: 0.5,
                  pick_rate: 0.1,
                  ban_rate: 0.1,
                  role_rate: 0.5,
                  tier: 3,
                },
              ],
            },
          },
        },
        catalog,
      ),
    ).toThrow("Unknown");
  });
});

describe("parseChampionAnalysis", () => {
  it("ダイヤ以上の成績と、対面・シナジー・ダメージタイプを読む", () => {
    const analysis = parseChampionAnalysis(
      {
        data: {
          damage_type: "AP",
          summary: {
            id: 103,
            average_stats: { play: 2000, win_rate: 0.52, pick_rate: 0.11, ban_rate: 0.04, tier: 1 },
          },
          strong_counters: [{ champion_id: 238, my_win_rate: 0.56, play: 100 }],
          weak_counters: [{ champion_id: 238, my_win_rate: 0.4, play: 400 }],
          synergies: {
            jungle: [
              {
                synergy_champion_id: 64,
                synergy_position: "JUNGLE",
                play: 800,
                win_rate: 0.58,
                score: 1.5,
              },
            ],
          },
        },
      },
      catalog,
      { championId: "Ahri", position: "mid", numericKey: 103 },
    );

    expect(analysis.damageType).toBe("ap");
    expect(analysis.winRate).toBe(0.52);
    expect(analysis.matchups).toEqual([{ opponentId: "Zed", games: 400, winRate: 0.4 }]);
    expect(analysis.synergies).toEqual([
      { allyId: "LeeSin", allyPosition: "jungle", games: 800, winRate: 0.58, score: 1.5 },
    ]);
  });

  it("応答のチャンピオンが違えば失敗する", () => {
    expect(() =>
      parseChampionAnalysis(
        {
          data: {
            summary: {
              id: 999,
              average_stats: { play: 1, win_rate: 0.5, pick_rate: 0.1, ban_rate: 0.1, tier: 3 },
            },
          },
        },
        catalog,
        { championId: "Ahri", position: "mid", numericKey: 103 },
      ),
    ).toThrow("一致しません");
  });
});
