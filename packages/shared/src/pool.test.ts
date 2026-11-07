import { describe, expect, it } from "vitest";

import { mergeSyncedPool, resolvePoolPosition } from "./pool.js";
import { parseRiotId } from "./profile.js";
import type { PoolEntry } from "./profile.js";
import type { MetaStat } from "./stats.js";

function meta(championId: string, position: MetaStat["position"], roleRate: number): MetaStat {
  return {
    championId,
    position,
    games: 1000,
    winRate: 0.5,
    pickRate: 0.05,
    banRate: 0.02,
    roleRate,
    tierRank: 2,
  };
}

function entry(partial: Partial<PoolEntry> & Pick<PoolEntry, "championId">): PoolEntry {
  return {
    position: "mid",
    source: "opgg",
    games: 10,
    winRate: 0.5,
    excluded: false,
    ...partial,
  };
}

describe("resolvePoolPosition", () => {
  const rows = [
    meta("Sylas", "mid", 0.7),
    meta("Sylas", "jungle", 0.2),
    meta("Sylas", "top", 0.05),
  ];

  it("ロール未設定なら、最も多いロールを選ぶ", () => {
    expect(resolvePoolPosition("Sylas", rows, [])).toBe("mid");
  });

  it("プレイヤーのロールの中で最も多いものを選ぶ", () => {
    expect(resolvePoolPosition("Sylas", rows, ["jungle", "top"])).toBe("jungle");
  });

  it("主要ロールでない、またはロールが合わないときは null", () => {
    expect(resolvePoolPosition("Sylas", rows, ["top"])).toBeNull();
    expect(resolvePoolPosition("Ahri", rows, [])).toBeNull();
  });
});

describe("mergeSyncedPool", () => {
  it("手動のエントリは残し、OP.GG 由来は入れ替える", () => {
    const merged = mergeSyncedPool(
      [
        entry({ championId: "Ahri", source: "manual", games: null, winRate: null }),
        entry({ championId: "Zed" }),
      ],
      [entry({ championId: "Syndra" })],
    );

    expect(merged.map((item) => item.championId)).toEqual(["Ahri", "Syndra"]);
  });

  it("引き続き出てくる OP.GG 由来の除外指定を引き継ぐ", () => {
    const merged = mergeSyncedPool(
      [entry({ championId: "Zed", excluded: true })],
      [entry({ championId: "Zed", games: 30 }), entry({ championId: "Ahri" })],
    );

    expect(merged.find((item) => item.championId === "Zed")).toMatchObject({
      games: 30,
      excluded: true,
    });
    expect(merged.find((item) => item.championId === "Ahri")?.excluded).toBe(false);
  });

  it("手動と同じチャンピオン × ロールは手動を優先する", () => {
    const merged = mergeSyncedPool(
      [entry({ championId: "Ahri", source: "manual", games: null, winRate: null })],
      [entry({ championId: "Ahri" })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe("manual");
  });
});

describe("parseRiotId", () => {
  it("ゲーム名とタグに分ける", () => {
    expect(parseRiotId(" Hide on bush#KR1 ")).toEqual({ gameName: "Hide on bush", tagLine: "KR1" });
  });

  it.each(["", "Faker", "#KR1", "Faker#", "Faker#TOOLONG", "ThisNameIsWayTooLong#JP1", "a#b#c"])(
    "形が違う(%s)なら null",
    (value) => {
      expect(parseRiotId(value)).toBeNull();
    },
  );
});
