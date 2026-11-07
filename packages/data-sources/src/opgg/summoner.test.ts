import { describe, expect, it } from "vitest";

import { decodeCompact } from "./compact.js";
import { parseSummonerPool } from "./summoner.js";

const COMPACT = `class LolGetSummonerProfile: data
class Data: summoner
class Summoner: ranked_most_champions
class RankedMostChampions: my_champion_stats
class ChampionStat: id,play,win,lose

LolGetSummonerProfile(Data(Summoner(RankedMostChampions([ChampionStat(777,63,31,32),ChampionStat(893,56,33,23)]))))`;

describe("parseSummonerPool", () => {
  it("使用回数の多い順に、チャンピオンと勝率を返す", () => {
    const pool = parseSummonerPool(decodeCompact(COMPACT));

    expect(pool.map((entry) => entry.numericKey)).toEqual([777, 893]);
    expect(pool[0]).toEqual({ numericKey: 777, games: 63, winRate: 31 / 63 });
  });

  it("ランクの戦績が無い(null)ならプールは空", () => {
    expect(parseSummonerPool({ data: { summoner: { ranked_most_champions: null } } })).toEqual([]);
  });

  it("同じチャンピオンが重複していたら合算する", () => {
    const pool = parseSummonerPool({
      data: {
        summoner: {
          ranked_most_champions: {
            my_champion_stats: [
              { id: 1, play: 10, win: 6 },
              { id: 1, play: 10, win: 4 },
              { id: 2, play: 0, win: 0 },
            ],
          },
        },
      },
    });

    expect(pool).toEqual([{ numericKey: 1, games: 20, winRate: 0.5 }]);
  });

  it("想定外の形ならエラーにする", () => {
    expect(() => parseSummonerPool({ data: {} })).toThrow();
  });
});
