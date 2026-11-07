import { describe, expect, it } from "vitest";

import { decodeCompact } from "./compact.js";

describe("decodeCompact", () => {
  it("クラス宣言の順序で、位置引数をフィールドに対応付ける", () => {
    const text = [
      "class Foo: data",
      "class Data: summary,damage_type,tags",
      "class Summary: id,name",
      "",
      'Foo(Data(Summary(517,"Sylas"),"AP",["a","b"]))',
    ].join("\n");

    expect(decodeCompact(text)).toEqual({
      data: { summary: { id: 517, name: "Sylas" }, damage_type: "AP", tags: ["a", "b"] },
    });
  });

  it("数値・null・真偽値・空配列・エスケープと区切り文字を含む文字列を読む", () => {
    const text = [
      "class Foo: items",
      "class Item: n,f,none,yes,no,empty,name",
      "",
      'Foo([Item(-3,0.5,null,true,false,[],"a,b)\\"c\\\\")])',
    ].join("\n");

    expect(decodeCompact(text)).toEqual({
      items: [{ n: -3, f: 0.5, none: null, yes: true, no: false, empty: [], name: 'a,b)"c\\' }],
    });
  });

  it("引数が宣言より少ないフィールドは含めない", () => {
    const text = ["class Foo: a,b", "", "Foo(1)"].join("\n");

    expect(decodeCompact(text)).toEqual({ a: 1 });
  });

  it("OP.GG のチャンピオン分析の実際の応答を読む", () => {
    const text = [
      "class LolGetChampionAnalysis: data",
      "class Data: summary,damage_type,strong_counters,synergies",
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
      'LolGetChampionAnalysis(Data(Summary(517,AverageStats(0.19),[Position("MID",Stats(13872,0.49,0.07,0.44,TierData(3,22))),Position("TOP",Stats(2546,0.49,0.01,0.08,TierData(4,51)))]),"AP",[StrongCounter(131,178,0.58)],Synergies([Top(517,"Sylas","MID",54,"Malphite","TOP",7,0,331,176,0.53,SynergyTierData(1,1,1,1))],[Top(517,"Sylas","MID",59,"Jarvan IV","JUNGLE",2,0,452,222,0.49,SynergyTierData(2,23,24,26))])))',
    ].join("\n");

    expect(decodeCompact(text)).toEqual({
      data: {
        summary: {
          id: 517,
          average_stats: { ban_rate: 0.19 },
          positions: [
            {
              name: "MID",
              stats: {
                play: 13872,
                win_rate: 0.49,
                pick_rate: 0.07,
                role_rate: 0.44,
                tier_data: { tier: 3, rank: 22 },
              },
            },
            {
              name: "TOP",
              stats: {
                play: 2546,
                win_rate: 0.49,
                pick_rate: 0.01,
                role_rate: 0.08,
                tier_data: { tier: 4, rank: 51 },
              },
            },
          ],
        },
        damage_type: "AP",
        strong_counters: [{ champion_id: 131, play: 178, my_win_rate: 0.58 }],
        synergies: {
          top: [
            {
              champion_id: 517,
              champion_name: "Sylas",
              position: "MID",
              synergy_champion_id: 54,
              synergy_champion_name: "Malphite",
              synergy_position: "TOP",
              score_rank: 7,
              score: 0,
              play: 331,
              win: 176,
              win_rate: 0.53,
              synergy_tier_data: { tier: 1, rank: 1, rank_prev: 1, rank_prev_patch: 1 },
            },
          ],
          jungle: [expect.objectContaining({ synergy_champion_name: "Jarvan IV", play: 452 })],
        },
      },
    });
  });

  it("宣言のないクラスは失敗する", () => {
    expect(() => decodeCompact(["class Foo: a", "", "Foo(Bar(1))"].join("\n"))).toThrow("Bar");
  });

  it("同じクラス名を別の形で再宣言されたら失敗する", () => {
    expect(() =>
      decodeCompact(["class Foo: a", "class Foo: a,b", "", "Foo(1)"].join("\n")),
    ).toThrow("食い違っています");
  });

  it("引数が宣言より多ければ失敗する", () => {
    expect(() => decodeCompact(["class Foo: a", "", "Foo(1,2)"].join("\n"))).toThrow("引数");
  });

  it("途中で切れた応答や、コンパクト形式でない文章は失敗する", () => {
    expect(() => decodeCompact(["class Foo: a", "", "Foo([1,2"].join("\n"))).toThrow();
    expect(() => decodeCompact("Internal server error")).toThrow("コンパクト形式");
  });
});
