import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import { frontlineValue, scoreComposition } from "./composition.js";

function champion(id: string, damageType: ChampionRef["damageType"], tags?: string[]): ChampionRef {
  return { id, nameJa: id, nameEn: id, numericKey: 1, damageType, ...(tags ? { tags } : {}) };
}

const AD = champion("Ad", "ad", ["Marksman"]);
const AD2 = champion("Ad2", "ad", ["Assassin"]);
const AP = champion("Ap", "ap", ["Mage"]);
const MIXED = champion("Mixed", "mixed", ["Mage"]);
const TANK = champion("Tank", "ap", ["Tank"]);
const FIGHTER = champion("Fighter", "ad", ["Fighter"]);

describe("frontlineValue", () => {
  it("タンクは 1、ファイターは 0.6、それ以外は 0", () => {
    expect(frontlineValue(TANK)).toBe(1);
    expect(frontlineValue(FIGHTER)).toBe(0.6);
    expect(frontlineValue(AD)).toBe(0);
    expect(frontlineValue(champion("None", null))).toBe(0);
  });

  it("タンクとファイターの両方なら、大きいほう", () => {
    expect(frontlineValue(champion("Both", "ad", ["Fighter", "Tank"]))).toBe(1);
  });
});

describe("scoreComposition", () => {
  it("味方のピックが無ければ計算しない", () => {
    expect(scoreComposition([], AP)).toBeNull();
  });

  it("候補の情報が無ければ計算しない", () => {
    expect(scoreComposition([AD], undefined)).toBeNull();
  });

  it("味方が AD に偏っているとき、AP の候補のほうが高い", () => {
    const allies = [AD, AD2];
    const ap = scoreComposition(allies, AP);
    const ad = scoreComposition(allies, champion("Ad3", "ad", ["Marksman"]));
    expect(ap && ad && ap.score > ad.score).toBe(true);
    expect(ap?.reasons).toContain("味方はAD寄りのため、APを足して物理・魔法のバランスを補える");
    expect(ad?.reasons).toContain("味方はAD寄りで、さらに偏る");
  });

  it("複合は AD・AP を半分ずつ数える", () => {
    const withMixed = scoreComposition([AD, AD2], MIXED);
    const withAd = scoreComposition([AD, AD2], champion("Ad3", "ad", ["Marksman"]));
    const withAp = scoreComposition([AD, AD2], AP);
    expect(withMixed && withAd && withAp).toBeTruthy();
    expect(withMixed!.score).toBeGreaterThan(withAd!.score);
    expect(withMixed!.score).toBeLessThan(withAp!.score);
  });

  it("前衛がいない味方には、タンクの候補のほうが高い", () => {
    const allies = [AD, AP];
    const tank = scoreComposition(allies, TANK);
    const mage = scoreComposition(allies, MIXED);
    expect(tank && mage && tank.score > mage.score).toBe(true);
    expect(tank?.reasons).toContain("前衛(タンク・ファイター)が不足している味方構成を補える");
  });

  it("前衛が足りているときは、前衛の候補に理由を付けない", () => {
    const result = scoreComposition([TANK, FIGHTER, AP], champion("Another", "ad", ["Tank"]));
    expect(result?.reasons).toEqual([]);
  });

  it("ダメージの種類が未取得なら、前衛だけで評価する", () => {
    const result = scoreComposition([AD], champion("Unknown", null, ["Tank"]));
    expect(result).not.toBeNull();
    expect(result?.score).toBeCloseTo(1 / 1.6);
  });

  it("タグが無ければ、ダメージのバランスだけで評価する", () => {
    const result = scoreComposition([AD], champion("NoTags", "ap"));
    expect(result?.score).toBe(1);
  });

  it("ダメージもタグも無ければ計算しない", () => {
    expect(scoreComposition([AD], champion("Nothing", null))).toBeNull();
  });

  it("スコアは 0〜1 に収まる", () => {
    const worst = scoreComposition([AD, AD2], champion("Worst", "ad"));
    const best = scoreComposition([AD, AD2], TANK);
    expect(worst?.score).toBeGreaterThanOrEqual(0);
    expect(best?.score).toBeLessThanOrEqual(1);
  });
});
