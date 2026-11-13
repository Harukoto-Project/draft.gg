import type { Profile, Team } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { buildPoolHints, buildTeamPoolHints } from "@/lib/poolHints";

function profile(id: string, pool: Profile["pool"]): Profile {
  return { id, displayName: id, riotId: null, region: null, roles: [], syncedAt: null, pool };
}

const ahri = {
  championId: "Ahri",
  position: "mid" as const,
  source: "manual" as const,
  games: 10,
  winRate: 0.6,
  excluded: false,
};

describe("buildPoolHints", () => {
  it("そのロールの、除外していない項目だけを返す", () => {
    const player = profile("a", [
      ahri,
      { ...ahri, championId: "Zed", excluded: true },
      { ...ahri, championId: "Garen", position: "top" },
    ]);

    expect(buildPoolHints(player, "mid")).toEqual({
      mid: [{ championId: "Ahri", games: 10, winRate: 0.6 }],
    });
  });

  it("プレイヤーかロールが無い、または 1 件も無ければ渡さない", () => {
    expect(buildPoolHints(undefined, "mid")).toBeUndefined();
    expect(buildPoolHints(profile("a", [ahri]), null)).toBeUndefined();
    expect(buildPoolHints(profile("a", [ahri]), "top")).toBeUndefined();
  });
});

describe("buildTeamPoolHints", () => {
  it("ロールに割り当てたプレイヤーのプールを、ロールごとに集める", () => {
    const team: Team = { id: "t", name: "T", members: { mid: "a", top: "ghost" } };

    expect(buildTeamPoolHints(team, [profile("a", [ahri])])).toEqual({
      mid: [{ championId: "Ahri", games: 10, winRate: 0.6 }],
    });
  });

  it("チームが無い、または 1 件も無ければ渡さない", () => {
    expect(buildTeamPoolHints(undefined, [])).toBeUndefined();
    expect(buildTeamPoolHints({ id: "t", name: "T", members: {} }, [])).toBeUndefined();
  });
});
