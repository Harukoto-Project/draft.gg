import { BAN_WEIGHT_PRESETS, PICK_WEIGHT_PRESETS } from "@draftgg/shared";
import type { DraftState, StatsSnapshot } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { recommend } from "./recommend.js";
import type { RecommendInput } from "./recommend.js";

const ahri = {
  id: "Ahri",
  nameJa: "アーリ",
  nameEn: "Ahri",
  numericKey: 103,
  damageType: "ap" as const,
};
const veigar = {
  id: "Veigar",
  nameJa: "ベイガー",
  nameEn: "Veigar",
  numericKey: 45,
  damageType: "ap" as const,
};
const zed = {
  id: "Zed",
  nameJa: "ゼド",
  nameEn: "Zed",
  numericKey: 238,
  damageType: "ad" as const,
};
const lee = {
  id: "LeeSin",
  nameJa: "リー・シン",
  nameEn: "Lee Sin",
  numericKey: 64,
  damageType: "ad" as const,
};
const yasuo = {
  id: "Yasuo",
  nameJa: "ヤスオ",
  nameEn: "Yasuo",
  numericKey: 157,
  damageType: "ad" as const,
};

function emptyAssignment() {
  return { top: null, jungle: null, mid: null, adc: null, support: null };
}

function createDraft(patch: Partial<DraftState> = {}): DraftState {
  return {
    format: "ranked",
    mySide: "blue",
    actions: [],
    assignments: { blue: emptyAssignment(), red: emptyAssignment() },
    me: { side: "blue", position: "mid" },
    ...patch,
  };
}

function metaRow(
  championId: string,
  position: StatsSnapshot["meta"][number]["position"],
  values: Partial<StatsSnapshot["meta"][number]> = {},
): StatsSnapshot["meta"][number] {
  return {
    championId,
    position,
    games: 10_000,
    winRate: 0.5,
    pickRate: 0.05,
    banRate: 0.05,
    roleRate: 0.8,
    tierRank: 3,
    ...values,
  };
}

function createInput(snapshot: Partial<StatsSnapshot>, draft = createDraft()): RecommendInput {
  return {
    draft,
    snapshot: {
      patch: "16.22",
      tier: "diamond_plus",
      champions: [ahri, veigar, zed, lee, yasuo],
      meta: [],
      matchups: [],
      synergies: [],
      ...snapshot,
    },
    preset: "solo",
    limit: 8,
    pickWeights: PICK_WEIGHT_PRESETS.solo,
    banWeights: BAN_WEIGHT_PRESETS.solo,
  };
}

describe("recommend", () => {
  it("メタの勝率とティアが高いチャンピオンを上にし、スコアと理由を返す", () => {
    const result = recommend(
      createInput({
        meta: [
          metaRow("Ahri", "mid", { winRate: 0.55, tierRank: 1 }),
          metaRow("Veigar", "mid", { winRate: 0.48, tierRank: 5 }),
        ],
      }),
    );

    const candidates = result.picks[0]?.candidates ?? [];
    expect(candidates.map((candidate) => candidate.championId)).toEqual(["Ahri", "Veigar"]);
    // ベイズ平均 (0.55*10000 + 0.5*300) / 10300 を 45%→0、55%→1 にし、勝率0.7 + ティア1の0.3
    expect(candidates[0]?.score).toBe(0.9898);
    expect(candidates[0]?.factors.meta).toBe(0.9898);
    expect(candidates[0]?.reasons).toEqual(["勝率55.0%(10,000試合) ティア1"]);
    expect(candidates[1]?.score).toBe(0.2141);
  });

  it("対面相手が決まっているときは、その勝率が高い候補を上にする", () => {
    const draft = createDraft();
    draft.assignments.red.mid = "Zed";
    const result = recommend(
      createInput(
        {
          meta: [metaRow("Ahri", "mid"), metaRow("Veigar", "mid")],
          matchups: [
            { championId: "Ahri", position: "mid", opponentId: "Zed", games: 1_000, winRate: 0.6 },
            {
              championId: "Veigar",
              position: "mid",
              opponentId: "Zed",
              games: 1_000,
              winRate: 0.42,
            },
          ],
        },
        draft,
      ),
    );

    const candidates = result.picks[0]?.candidates ?? [];
    expect(candidates.map((candidate) => candidate.championId)).toEqual(["Ahri", "Veigar"]);
    expect(candidates[0]?.reasons).toContain("対 ゼド 勝率60.0%(1,000試合)");
  });

  it("味方のロールが決まっているときは、そのシナジーを理由に出す", () => {
    const draft = createDraft();
    draft.assignments.blue.jungle = "LeeSin";
    const result = recommend(
      createInput(
        {
          meta: [metaRow("Ahri", "mid"), metaRow("Veigar", "mid")],
          synergies: [
            {
              championId: "Ahri",
              position: "mid",
              allyId: "LeeSin",
              allyPosition: "jungle",
              games: 800,
              winRate: 0.58,
              score: 1,
            },
          ],
        },
        draft,
      ),
    );

    expect(result.picks[0]?.candidates[0]?.championId).toBe("Ahri");
    expect(result.picks[0]?.candidates[0]?.reasons).toContain(
      "リー・シン(ジャングル)との勝率58.0%(800試合)",
    );
  });

  it("BAN済み・ピック済みのチャンピオンは候補から除く", () => {
    const draft = createDraft();
    draft.actions = [
      { step: 0, type: "ban", side: "blue", championId: "Ahri" },
      { step: 1, type: "pick", side: "red", championId: "Veigar" },
    ];
    const result = recommend(
      createInput(
        {
          meta: [
            metaRow("Ahri", "mid", { winRate: 0.6, tierRank: 1 }),
            metaRow("Veigar", "mid", { winRate: 0.6, tierRank: 1 }),
            metaRow("Zed", "mid", { winRate: 0.5, tierRank: 3 }),
          ],
        },
        draft,
      ),
    );

    expect(result.picks[0]?.candidates.map((candidate) => candidate.championId)).toEqual(["Zed"]);
    expect(result.bans.map((candidate) => candidate.championId)).toEqual(["Zed"]);
  });

  it("試合数が閾値未満の対面は、スコアを残したままサンプル不足と出す", () => {
    const draft = createDraft();
    draft.assignments.red.mid = "Zed";
    const result = recommend(
      createInput(
        {
          meta: [metaRow("Ahri", "mid", { games: 100 })],
          matchups: [
            { championId: "Ahri", position: "mid", opponentId: "Zed", games: 40, winRate: 0.8 },
          ],
        },
        draft,
      ),
    );

    const reasons = result.picks[0]?.candidates[0]?.reasons ?? [];
    expect(reasons.filter((reason) => reason === "サンプル不足")).toHaveLength(2);
    expect(result.picks[0]?.candidates[0]?.score).toBeGreaterThan(0);
  });

  it("相手のロールが未確定のときは、ロール割合で対面を加重する", () => {
    const draft = createDraft();
    draft.actions = [{ step: 0, type: "pick", side: "red", championId: "Yasuo" }];
    const result = recommend(
      createInput(
        {
          meta: [metaRow("Ahri", "mid"), metaRow("Yasuo", "mid", { roleRate: 0.6 })],
          matchups: [
            { championId: "Ahri", position: "mid", opponentId: "Yasuo", games: 500, winRate: 0.56 },
          ],
        },
        draft,
      ),
    );

    expect(result.picks[0]?.candidates[0]?.reasons.join(" ")).toContain(
      "ロール未確定のため割合で加重。対 ヤスオ 勝率56.0%(500試合)",
    );
  });

  it("主要ロール未満のチャンピオンは候補にしない", () => {
    const result = recommend(
      createInput({
        meta: [metaRow("Ahri", "mid", { roleRate: 0.09, winRate: 0.6, tierRank: 1 })],
      }),
    );

    expect(result.picks[0]?.candidates).toEqual([]);
    expect(result.bans).toEqual([]);
  });

  it("ソロのBANは、自分のピックに強いチャンピオンを上にする", () => {
    const draft = createDraft();
    draft.assignments.blue.mid = "Ahri";
    const result = recommend(
      createInput(
        {
          meta: [metaRow("Zed", "mid"), metaRow("Veigar", "mid"), metaRow("Ahri", "mid")],
          matchups: [
            { championId: "Zed", position: "mid", opponentId: "Ahri", games: 1_000, winRate: 0.62 },
            {
              championId: "Veigar",
              position: "mid",
              opponentId: "Ahri",
              games: 1_000,
              winRate: 0.4,
            },
          ],
        },
        draft,
      ),
    );

    expect(result.bans.map((candidate) => candidate.championId).slice(0, 2)).toEqual([
      "Zed",
      "Veigar",
    ]);
    expect(result.bans[0]?.reasons).toContain("ミッドで対 アーリ 勝率62.0%(1,000試合)");
    expect(result.bans.map((candidate) => candidate.championId)).not.toContain("Ahri");
  });

  it("プロの重みを変えても、データが無いのでスコアは変わらない", () => {
    const base = createInput({
      meta: [metaRow("Ahri", "mid", { winRate: 0.55, tierRank: 1 })],
    });
    const changed = recommend({
      ...base,
      pickWeights: { ...base.pickWeights, pro: 0.9 },
    });

    expect(changed.picks[0]?.candidates[0]?.score).toBe(
      recommend(base).picks[0]?.candidates[0]?.score,
    );
  });

  it("チームで自分の枠が無いときは、空いているロールごとに候補を返す", () => {
    const result = recommend({
      ...createInput({ meta: [metaRow("Ahri", "mid")] }, createDraft({ me: undefined })),
      preset: "team",
      pickWeights: PICK_WEIGHT_PRESETS.team,
      banWeights: BAN_WEIGHT_PRESETS.team,
    });

    expect(result.preset).toBe("team");
    expect(result.picks.map((group) => group.position)).toEqual([
      "top",
      "jungle",
      "mid",
      "adc",
      "support",
    ]);
    expect(result.picks.find((group) => group.position === "mid")?.candidates[0]?.championId).toBe(
      "Ahri",
    );
  });
});
