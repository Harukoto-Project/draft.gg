import { describe, expect, it } from "vitest";

import { draftStateSchema } from "./draft.js";
import {
  actionsMatchRules,
  assignPickPosition,
  changeFormat,
  championIdsInUse,
  clearStep,
  createEmptyDraft,
  draftHasChampion,
  nextSuggestedStep,
  placeChampion,
  positionOfChampion,
  setMySide,
  sideTurns,
  suggestedSteps,
  turnsFor,
} from "./draft-rules.js";

function sides(format: "ranked" | "tournament", type: "ban" | "pick"): string {
  return turnsFor(format)
    .filter((turn) => turn.type === type)
    .map((turn) => (turn.side === "blue" ? "B" : "R"))
    .join("");
}

describe("進行ルール", () => {
  it("ランク戦はBANが同時で、そのあとピック順になる", () => {
    const turns = turnsFor("ranked");
    expect(turns).toHaveLength(20);
    expect(sides("ranked", "ban")).toBe("BBBBBRRRRR");
    expect(sides("ranked", "pick")).toBe("BRRBBRRBBR");
    expect(
      new Set(turns.filter((turn) => turn.type === "ban").map((turn) => turn.phase)).size,
    ).toBe(1);
    expect(sideTurns("ranked", "blue", "pick")).toHaveLength(5);
    expect(sideTurns("ranked", "red", "ban")).toHaveLength(5);
  });

  it("大会形式はBANとピックが2巡する", () => {
    expect(sides("tournament", "ban")).toBe("BRBRBRRBRB");
    expect(sides("tournament", "pick")).toBe("BRRBBRRBBR");
    expect(turnsFor("tournament").every((turn, index) => turn.phase === index)).toBe(true);
  });

  it("空のドラフトはスキーマを満たし、ランク戦の最初はBANの全枠", () => {
    const draft = createEmptyDraft({ format: "ranked", mySide: "blue" });
    expect(draftStateSchema.parse(draft)).toEqual(draft);
    expect(suggestedSteps(draft)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(draftHasChampion(draft)).toBe(false);
  });

  it("チャンピオンを入れると次の空枠へ進み、同じチャンピオンは置けない", () => {
    let draft = createEmptyDraft({ format: "ranked", mySide: "blue" });
    draft = placeChampion(draft, 0, "Ahri");
    expect(championIdsInUse(draft).has("Ahri")).toBe(true);
    expect(nextSuggestedStep(draft, 0)).toBe(1);
    expect(placeChampion(draft, 1, "Ahri")).toBe(draft);
  });

  it("BANを埋め終わると青の最初のピックになる", () => {
    let draft = createEmptyDraft({ format: "ranked", mySide: "red" });
    for (const step of suggestedSteps(draft)) {
      draft = placeChampion(draft, step, `Ban${step}`);
    }
    expect(suggestedSteps(draft)).toEqual([10]);
    expect(draft.actions[10]?.side).toBe("blue");
  });

  it("ピックのロールは置き換え後も残り、外すと消える", () => {
    let draft = createEmptyDraft({ format: "tournament", mySide: "blue" });
    const pick = turnsFor("tournament").find((turn) => turn.type === "pick");
    expect(pick).toBeDefined();
    if (!pick) return;

    draft = placeChampion(draft, pick.step, "Ahri");
    draft = assignPickPosition(draft, pick.step, "mid");
    expect(positionOfChampion(draft, "blue", "Ahri")).toBe("mid");

    draft = placeChampion(draft, pick.step, "Syndra");
    expect(positionOfChampion(draft, "blue", "Ahri")).toBeNull();
    expect(positionOfChampion(draft, "blue", "Syndra")).toBe("mid");

    draft = clearStep(draft, pick.step);
    expect(draft.actions[pick.step]?.championId).toBeNull();
    expect(positionOfChampion(draft, "blue", "Syndra")).toBeNull();
  });

  it("同じロールを別のピックに付けると、前の対応は外れる", () => {
    let draft = createEmptyDraft({ format: "ranked", mySide: "blue" });
    const picks = sideTurns("ranked", "blue", "pick");
    const first = picks[0];
    const second = picks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;

    draft = placeChampion(draft, first.step, "Ahri");
    draft = placeChampion(draft, second.step, "Syndra");
    draft = assignPickPosition(draft, first.step, "mid");
    draft = assignPickPosition(draft, second.step, "mid");
    expect(positionOfChampion(draft, "blue", "Ahri")).toBeNull();
    expect(draft.assignments.blue.mid).toBe("Syndra");
  });

  it("BANにはロールを付けず、形式を変えると入力が消える", () => {
    let draft = createEmptyDraft({ format: "ranked", mySide: "blue" });
    draft = placeChampion(draft, 0, "Ahri");
    expect(assignPickPosition(draft, 0, "mid")).toBe(draft);

    draft = setMySide(draft, "red");
    expect(draft.mySide).toBe("red");
    expect(draftHasChampion(draft)).toBe(true);

    const changed = changeFormat(draft, "tournament");
    expect(changed.format).toBe("tournament");
    expect(changed.mySide).toBe("red");
    expect(draftHasChampion(changed)).toBe(false);
    expect(actionsMatchRules(changed)).toBe(true);
    expect(actionsMatchRules({ ...changed, actions: changed.actions.slice(0, 3) })).toBe(false);
  });
});
