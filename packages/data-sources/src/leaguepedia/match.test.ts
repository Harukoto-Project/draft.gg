import type { ProGameDraft } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { createChampionResolver } from "../pro/names.js";
import { normalizeTeamName } from "../pro/names.js";
import { matchLeaguepediaDrafts } from "./match.js";
import type { LeaguepediaDraft } from "./client.js";

const champions = [
  { id: "Ahri", nameEn: "Ahri" },
  { id: "Zed", nameEn: "Zed" },
];

function game(patch: Partial<ProGameDraft> = {}): ProGameDraft {
  return {
    gameKey: "oe:1",
    league: "LCK",
    event: "Spring",
    playedAt: new Date("2026-03-01T12:00:00Z"),
    gameNumber: "1",
    patch: "16.1",
    blueTeam: "Gen.G",
    redTeam: "T1",
    winnerSide: "blue",
    actions: [],
    ...patch,
  };
}

const draft: LeaguepediaDraft = {
  matchDate: "2026-03-01",
  blueTeam: "Gen.G Esports",
  redTeam: "T1",
  gameNumber: "1",
  bluePicks: ["Ahri"],
  redPicks: ["Zed"],
  blueBans: [],
  redBans: [],
};

describe("matchLeaguepediaDrafts", () => {
  it("チーム名の表記ゆれを吸収して、青サイド先攻の順番を付ける", () => {
    expect(normalizeTeamName("Gen.G Esports")).toBe(normalizeTeamName("Gen.G"));
    const { fills, ambiguous } = matchLeaguepediaDrafts(
      [game()],
      [draft],
      createChampionResolver(champions),
    );
    expect(ambiguous).toBe(0);
    expect(fills).toEqual([
      {
        gameKey: "oe:1",
        orders: [
          { championId: "Ahri", type: "pick", order: 1 },
          { championId: "Zed", type: "pick", order: 2 },
        ],
      },
    ]);
  });

  it("同じキーの試合が複数あるときは更新しない", () => {
    const { fills, ambiguous } = matchLeaguepediaDrafts(
      [game(), game({ gameKey: "oe:2" })],
      [draft],
      createChampionResolver(champions),
    );
    expect(fills).toEqual([]);
    expect(ambiguous).toBe(1);
  });
});
