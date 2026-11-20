import { actionsMatchRules, draftStateSchema } from "@draftgg/shared";
import type { Champion, DraftState } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { championIdByKey, draftFromChampSelect } from "@/services/lcu-draft";
import type { ChampSelectSnapshot } from "@/services/lcu";

const ID_BY_KEY = new Map([
  [1, "Annie"],
  [2, "Olaf"],
  [3, "Galio"],
  [4, "TwistedFate"],
  [5, "XinZhao"],
  [103, "Ahri"],
  [104, "Graves"],
]);

function snapshot(partial: Partial<ChampSelectSnapshot> = {}): ChampSelectSnapshot {
  return {
    format: "ranked",
    mySide: "blue",
    myPosition: null,
    phase: "BAN_PICK",
    bans: [],
    picks: [],
    ...partial,
  };
}

function championIdAt(draft: DraftState, step: number): string | null | undefined {
  return draft.actions.find((action) => action.step === step)?.championId;
}

describe("draftFromChampSelect", () => {
  it("手順が空でも、形式の進行ルールどおりの盤面になる", () => {
    const draft = draftFromChampSelect(snapshot({ mySide: "red" }), ID_BY_KEY);
    expect(draft.format).toBe("ranked");
    expect(draft.mySide).toBe("red");
    expect(draft.actions.every((action) => action.championId === null)).toBe(true);
    expect(actionsMatchRules(draft)).toBe(true);
    expect(draftStateSchema.safeParse(draft).success).toBe(true);
  });

  it("BAN はサイドごとの順に、そのサイドの BAN 枠へ入る", () => {
    const draft = draftFromChampSelect(
      snapshot({
        bans: [
          { side: "blue", championKey: 1 },
          { side: "red", championKey: 2 },
          { side: "blue", championKey: 3 },
          { side: "blue", championKey: null },
        ],
      }),
      ID_BY_KEY,
    );
    const bans = draft.actions.filter((action) => action.type === "ban");
    const blue = bans.filter((action) => action.side === "blue").map((a) => a.championId);
    const red = bans.filter((action) => action.side === "red").map((a) => a.championId);
    expect(blue.slice(0, 4)).toEqual(["Annie", "Galio", null, null]);
    expect(red.slice(0, 2)).toEqual(["Olaf", null]);
  });

  it("ピックはサイドごとの順に入り、ロールがわかるものは割り当てる", () => {
    const draft = draftFromChampSelect(
      snapshot({
        myPosition: "mid",
        picks: [
          { side: "blue", championKey: 103, position: "mid" },
          { side: "red", championKey: 104, position: null },
          { side: "red", championKey: 4, position: null },
          { side: "blue", championKey: null, position: "jungle" },
        ],
      }),
      ID_BY_KEY,
    );
    const picks = draft.actions.filter((action) => action.type === "pick");
    // ランク戦のピック順: B1 / R1 R2 / B2 ...
    expect(picks.slice(0, 4).map((action) => action.championId)).toEqual([
      "Ahri",
      "Graves",
      "TwistedFate",
      null,
    ]);
    expect(draft.assignments.blue.mid).toBe("Ahri");
    expect(draft.assignments.blue.jungle).toBeNull();
    // 相手のロールは分からないので、割り当てない
    expect(Object.values(draft.assignments.red).every((id) => id === null)).toBe(true);
  });

  it("自分のロールが分かれば me に入り、分からなければ入らない", () => {
    expect(draftFromChampSelect(snapshot({ myPosition: "support" }), ID_BY_KEY).me).toEqual({
      side: "blue",
      position: "support",
    });
    expect(draftFromChampSelect(snapshot(), ID_BY_KEY).me).toBeUndefined();
  });

  it("一覧にないチャンピオンは、空の枠のままにする", () => {
    const draft = draftFromChampSelect(
      snapshot({ bans: [{ side: "blue", championKey: 9999 }] }),
      ID_BY_KEY,
    );
    expect(draft.actions.every((action) => action.championId === null)).toBe(true);
  });

  it("大会形式は、進行ルールの順(B R B R ...)で BAN が入る", () => {
    const draft = draftFromChampSelect(
      snapshot({
        format: "tournament",
        bans: [
          { side: "blue", championKey: 1 },
          { side: "red", championKey: 2 },
          { side: "blue", championKey: 3 },
        ],
        picks: [{ side: "blue", championKey: 5, position: null }],
      }),
      ID_BY_KEY,
    );
    expect(draft.format).toBe("tournament");
    expect(actionsMatchRules(draft)).toBe(true);
    // 第1BAN: B R B R B R → step 0 / 1 / 2
    expect([0, 1, 2].map((step) => championIdAt(draft, step))).toEqual(["Annie", "Olaf", "Galio"]);
    // 第1ピックの先頭(B1)は step 6
    expect(championIdAt(draft, 6)).toBe("XinZhao");
  });

  it("枠より多い手が来ても、あふれた分は捨てる", () => {
    const bans = Array.from({ length: 8 }, () => ({ side: "blue" as const, championKey: 1 }));
    const draft = draftFromChampSelect(snapshot({ bans }), ID_BY_KEY);
    expect(draft.actions).toHaveLength(20);
    expect(draft.actions.filter((action) => action.championId !== null)).toHaveLength(5);
  });
});

describe("championIdByKey", () => {
  it("Riot の数値 ID からチャンピオン ID を引ける", () => {
    const champions = [
      { id: "Ahri", numericKey: 103 },
      { id: "Annie", numericKey: 1 },
    ] as Champion[];
    const map = championIdByKey(champions);
    expect(map.get(103)).toBe("Ahri");
    expect(map.get(1)).toBe("Annie");
    expect(map.get(2)).toBeUndefined();
  });
});
