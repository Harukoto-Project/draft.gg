import { MIN_PRO_GAMES_PER_PATCH } from "@draftgg/shared";
import type { ProGameDraft } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { aggregateProStats } from "./aggregate.js";

function game(patch: string, league: ProGameDraft["league"] = "LCK"): ProGameDraft {
  return {
    gameKey: `${league}-${patch}-${Math.random()}`,
    league,
    event: "Spring",
    playedAt: new Date("2026-03-01T00:00:00Z"),
    gameNumber: "1",
    patch,
    blueTeam: "Blue",
    redTeam: "Red",
    winnerSide: "blue",
    actions: [
      {
        side: "blue",
        type: "pick",
        order: 1,
        position: "mid",
        championId: "Ahri",
      },
      {
        side: "red",
        type: "ban",
        order: 2,
        position: null,
        championId: "Zed",
      },
    ],
  };
}

function many(
  patch: string,
  count: number,
  league: ProGameDraft["league"] = "LCK",
): ProGameDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    ...game(patch, league),
    gameKey: `${league}-${patch}-${index}`,
    winnerSide: index < 8 ? "blue" : "red",
    actions: [
      {
        side: "blue",
        type: "pick",
        order: index < 4 ? 1 : 8,
        position: "mid" as const,
        championId: "Ahri",
      },
      {
        side: "red",
        type: "ban",
        order: null,
        position: null,
        championId: index % 2 === 0 ? "Zed" : "Ahri",
      },
    ],
  }));
}

describe("aggregateProStats", () => {
  it("20件以上ある新しい2パッチを合算し、それより古いパッチは含めない", () => {
    const games = [
      ...many("16.22", MIN_PRO_GAMES_PER_PATCH),
      ...many("16.21", MIN_PRO_GAMES_PER_PATCH),
      ...many("16.20", MIN_PRO_GAMES_PER_PATCH),
    ];
    const rows = aggregateProStats(games, new Date("2026-11-07T00:00:00Z"));
    const major = rows.filter((row) => row.scope === "major" && row.championId === "Ahri");

    expect(major.map((row) => row.position).sort()).toEqual(["mid"]);
    const mid = major[0];
    expect(mid?.games).toBe(MIN_PRO_GAMES_PER_PATCH * 2);
    expect(mid?.picks).toBe(MIN_PRO_GAMES_PER_PATCH * 2);
    expect(rows.some((row) => row.scope === "patch:16.20")).toBe(false);
    expect(rows.some((row) => row.scope === "patch:16.22")).toBe(true);
    expect(rows.some((row) => row.scope === "league:LCK")).toBe(true);
  });

  it("序盤ピック率は順番があるピックだけで計算し、BANだけのチャンピオンも残す", () => {
    const games = many("16.22", MIN_PRO_GAMES_PER_PATCH);
    const rows = aggregateProStats(games, new Date("2026-11-07T00:00:00Z"));
    const ahri = rows.find(
      (row) => row.scope === "major" && row.championId === "Ahri" && row.position === "mid",
    );
    const zed = rows.find((row) => row.scope === "major" && row.championId === "Zed");

    expect(ahri?.earlyPickRate).toBe(4 / MIN_PRO_GAMES_PER_PATCH);
    expect(ahri?.winRate).toBe(8 / MIN_PRO_GAMES_PER_PATCH);
    expect(zed?.picks).toBe(0);
    expect(zed?.bans).toBe(MIN_PRO_GAMES_PER_PATCH / 2);
  });

  it("20件未満のパッチしか無いときは空を返す", () => {
    expect(aggregateProStats(many("16.22", MIN_PRO_GAMES_PER_PATCH - 1), new Date()).length).toBe(
      0,
    );
  });
});
