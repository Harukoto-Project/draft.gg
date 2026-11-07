import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { extractToolJson, parseChampionAnalysis, parseLaneMeta } from "./parse.js";

const catalog: ChampionRef[] = [
  { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: null },
  { id: "Zed", nameJa: "ゼド", nameEn: "Zed", numericKey: 238, damageType: null },
  { id: "LeeSin", nameJa: "リー・シン", nameEn: "Lee Sin", numericKey: 64, damageType: null },
  { id: "Velkoz", nameJa: "ベルコズ", nameEn: "Vel'Koz", numericKey: 161, damageType: null },
];

function positionStats(
  name: string,
  stats: { play: number; win_rate: number; pick_rate: number; tier: number },
) {
  return {
    name,
    stats: {
      play: stats.play,
      win_rate: stats.win_rate,
      pick_rate: stats.pick_rate,
      role_rate: 0.5,
      tier_data: { tier: stats.tier, rank: 1 },
    },
  };
}

describe("extractToolJson", () => {
  it("MCP の text から JSON を読む", () => {
    expect(extractToolJson({ content: [{ type: "text", text: '{"data":1}' }] })).toEqual({
      data: 1,
    });
  });

  it("本文が空なら失敗する", () => {
    expect(() => extractToolJson({ content: [] })).toThrow("本文がありません");
  });

  it("JSON でなければ、コンパクト形式として読む", () => {
    const text = ["class Foo: data", "class Data: id", "", "Foo(Data(517))"].join("\n");

    expect(extractToolJson({ content: [{ type: "text", text }] })).toEqual({ data: { id: 517 } });
  });
});

/** OP.GG MCP が実際に返すコンパクト形式(応答を抜粋したもの) */
describe("実際の応答形式(コンパクト形式)", () => {
  const realCatalog: ChampionRef[] = [
    { id: "Sylas", nameJa: "サイラス", nameEn: "Sylas", numericKey: 517, damageType: null },
    {
      id: "Malphite",
      nameJa: "マルファイト",
      nameEn: "Malphite",
      numericKey: 54,
      damageType: null,
    },
    {
      id: "JarvanIV",
      nameJa: "ジャーバンⅣ",
      nameEn: "Jarvan IV",
      numericKey: 59,
      damageType: null,
    },
    { id: "Zed", nameJa: "ゼド", nameEn: "Zed", numericKey: 238, damageType: null },
    {
      id: "DrMundo",
      nameJa: "ドクター・ムンド",
      nameEn: "Dr. Mundo",
      numericKey: 36,
      damageType: null,
    },
  ];

  function toolResult(lines: string[]) {
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  it("メタ一覧を読む", () => {
    const rows = parseLaneMeta(
      extractToolJson(
        toolResult([
          "class LolListLaneMetaChampions: data",
          "class Data: positions",
          "class Positions: top,mid",
          "class Top: champion,play,win_rate,pick_rate,role_rate,ban_rate,tier,rank",
          "",
          'LolListLaneMetaChampions(Data(Positions([Top("Dr. Mundo",15109,0.51,0.03,0.86,0.02,2,22),Top("Sylas",5186,0.49,0.01,0.08,0.17,4,52)],[Top("Sylas",30433,0.49,0.07,0.44,0.17,3,21)])))',
        ]),
      ),
      realCatalog,
    );

    expect(rows).toEqual([
      {
        championId: "DrMundo",
        position: "top",
        games: 15109,
        winRate: 0.51,
        pickRate: 0.03,
        banRate: 0.02,
        roleRate: 0.86,
        tierRank: 2,
      },
      {
        championId: "Sylas",
        position: "top",
        games: 5186,
        winRate: 0.49,
        pickRate: 0.01,
        banRate: 0.17,
        roleRate: 0.08,
        tierRank: 4,
      },
      {
        championId: "Sylas",
        position: "mid",
        games: 30433,
        winRate: 0.49,
        pickRate: 0.07,
        banRate: 0.17,
        roleRate: 0.44,
        tierRank: 3,
      },
    ]);
  });

  it("チャンピオン分析を、ロール別の値で読む", () => {
    const payload = extractToolJson(
      toolResult([
        "class LolGetChampionAnalysis: data",
        "class Data: summary,damage_type,strong_counters,weak_counters,synergies",
        "class Summary: id,average_stats,positions",
        "class AverageStats: ban_rate",
        "class Position: name,stats",
        "class Stats: play,win_rate,pick_rate,role_rate,tier_data",
        "class TierData: tier,rank",
        "class StrongCounter: champion_id,play,my_win_rate",
        "class Synergies: top,jungle",
        "class Top: champion_id,champion_name,position,synergy_champion_id,synergy_champion_name,synergy_position,score_rank,score,play,win,win_rate,synergy_tier_data",
        "class SynergyTierData: tier,rank,rank_prev,rank_prev_patch",
        "",
        'LolGetChampionAnalysis(Data(Summary(517,AverageStats(0.19),[Position("MID",Stats(13872,0.49,0.07,0.44,TierData(3,22))),Position("TOP",Stats(2546,0.49,0.01,0.08,TierData(4,51)))]),"AP",[StrongCounter(238,483,0.54)],[StrongCounter(238,147,0.37)],Synergies([Top(517,"Sylas","MID",54,"Malphite","TOP",7,0,331,176,0.53,SynergyTierData(1,1,1,1))],[Top(517,"Sylas","MID",59,"Jarvan IV","JUNGLE",2,0,452,222,0.49,SynergyTierData(2,23,24,26))])))',
      ]),
    );

    const top = parseChampionAnalysis(payload, realCatalog, {
      championId: "Sylas",
      position: "top",
      numericKey: 517,
    });

    expect(top).toMatchObject({
      games: 2546,
      winRate: 0.49,
      pickRate: 0.01,
      banRate: 0.19,
      tierRank: 4,
      damageType: "ap",
    });
    // 同じ対面が両方にあるときは、試合数が多い方を残す
    expect(top.matchups).toEqual([{ opponentId: "Zed", games: 483, winRate: 0.54 }]);
    expect(top.synergies).toEqual([
      { allyId: "Malphite", allyPosition: "top", games: 331, winRate: 0.53, score: 0 },
      { allyId: "JarvanIV", allyPosition: "jungle", games: 452, winRate: 0.49, score: 0 },
    ]);
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
            average_stats: { ban_rate: 0.04 },
            positions: [
              positionStats("MID", { play: 2000, win_rate: 0.52, pick_rate: 0.11, tier: 1 }),
              positionStats("TOP", { play: 300, win_rate: 0.47, pick_rate: 0.01, tier: 4 }),
            ],
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

  const multiRolePayload = {
    data: {
      summary: {
        id: 103,
        average_stats: { ban_rate: 0.04 },
        positions: [
          positionStats("MID", { play: 2000, win_rate: 0.52, pick_rate: 0.11, tier: 1 }),
          positionStats("TOP", { play: 300, win_rate: 0.47, pick_rate: 0.01, tier: 4 }),
        ],
      },
    },
  };

  it("ロール別の試合数・勝率・ティアを対象ロールの要素から取る", () => {
    const top = parseChampionAnalysis(multiRolePayload, catalog, {
      championId: "Ahri",
      position: "top",
      numericKey: 103,
    });
    expect(top).toMatchObject({ games: 300, winRate: 0.47, pickRate: 0.01, tierRank: 4 });
    expect(top.banRate).toBe(0.04);

    const mid = parseChampionAnalysis(multiRolePayload, catalog, {
      championId: "Ahri",
      position: "mid",
      numericKey: 103,
    });
    expect(mid).toMatchObject({ games: 2000, winRate: 0.52, tierRank: 1 });
  });

  it("対象ロールの統計が無い応答は失敗する", () => {
    expect(() =>
      parseChampionAnalysis(multiRolePayload, catalog, {
        championId: "Ahri",
        position: "support",
        numericKey: 103,
      }),
    ).toThrow("対象ロールの統計がありません");
  });

  it("同じ組のシナジーが重複したら試合数が多い方を残す", () => {
    const analysis = parseChampionAnalysis(
      {
        data: {
          ...multiRolePayload.data,
          synergies: {
            jungle: [
              { synergy_champion_id: 64, synergy_position: "JUNGLE", play: 100, win_rate: 0.5 },
              { synergy_champion_id: 64, synergy_position: "JUNGLE", play: 400, win_rate: 0.6 },
            ],
          },
        },
      },
      catalog,
      { championId: "Ahri", position: "mid", numericKey: 103 },
    );
    expect(analysis.synergies).toEqual([
      { allyId: "LeeSin", allyPosition: "jungle", games: 400, winRate: 0.6, score: 0 },
    ]);
  });

  it("応答のチャンピオンが違えば失敗する", () => {
    expect(() =>
      parseChampionAnalysis(
        {
          data: {
            summary: {
              id: 999,
              average_stats: { ban_rate: 0.1 },
              positions: [
                positionStats("MID", { play: 1, win_rate: 0.5, pick_rate: 0.1, tier: 3 }),
              ],
            },
          },
        },
        catalog,
        { championId: "Ahri", position: "mid", numericKey: 103 },
      ),
    ).toThrow("一致しません");
  });
});
