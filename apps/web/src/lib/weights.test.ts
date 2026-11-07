import { BAN_WEIGHT_PRESETS, PICK_WEIGHT_PRESETS } from "@draftgg/shared";
import { describe, expect, it } from "vitest";

import {
  hasOverrides,
  parseWeightOverrides,
  requestWeights,
  resetPreset,
  resolveWeights,
  setWeight,
  weightsTotal,
} from "./weights";

describe("setWeight", () => {
  it("初期値と違う値は、差分として持つ", () => {
    const next = setWeight({}, "solo", "pick", "meta", 0.5);
    expect(next).toEqual({ solo: { pick: { meta: 0.5 } } });
    expect(resolveWeights("solo", next).pick.meta).toBe(0.5);
    expect(resolveWeights("solo", next).pick.counter).toBe(PICK_WEIGHT_PRESETS.solo.counter);
  });

  it("初期値に戻したら、上書きを外す", () => {
    const changed = setWeight({}, "team", "ban", "pro", 0.8);
    const back = setWeight(changed, "team", "ban", "pro", BAN_WEIGHT_PRESETS.team.pro);
    expect(back).toEqual({});
    expect(hasOverrides(back, "team")).toBe(false);
  });

  it("0〜1 に丸めて、0.05 刻みに揃える", () => {
    expect(setWeight({}, "solo", "pick", "meta", 5).solo?.pick?.meta).toBe(1);
    expect(setWeight({}, "solo", "pick", "meta", -1).solo?.pick?.meta).toBe(0);
    expect(setWeight({}, "solo", "pick", "meta", 0.52).solo?.pick?.meta).toBeCloseTo(0.5);
  });

  it("別のプリセットの上書きには触れない", () => {
    const next = setWeight({ team: { pick: { pro: 0.9 } } }, "solo", "pick", "meta", 0.5);
    expect(next.team).toEqual({ pick: { pro: 0.9 } });
  });
});

describe("resetPreset / requestWeights", () => {
  it("リセットしたプリセットだけ消える", () => {
    const overrides = { solo: { pick: { meta: 0.5 } }, team: { ban: { pro: 0.5 } } };
    expect(resetPreset(overrides, "solo")).toEqual({ team: { ban: { pro: 0.5 } } });
  });

  it("上書きが無ければ重みを送らない", () => {
    expect(requestWeights("solo", {})).toBeUndefined();
    expect(requestWeights("solo", { solo: { pick: { meta: 0.5 } } })).toEqual({
      pick: { meta: 0.5 },
    });
  });
});

describe("weightsTotal", () => {
  it("合計を返す。すべて 0 なら 0", () => {
    expect(weightsTotal({ a: 0, b: 0 })).toBe(0);
    expect(weightsTotal({ a: 0.25, b: 0.5 })).toBe(0.75);
  });
});

describe("parseWeightOverrides", () => {
  it("保存した形を読む", () => {
    const raw = JSON.stringify({ solo: { pick: { meta: 0.4 }, ban: { pro: 0.2 } } });
    expect(parseWeightOverrides(raw)).toEqual({ solo: { pick: { meta: 0.4 }, ban: { pro: 0.2 } } });
  });

  it("壊れた JSON や、オブジェクトでない値は空として扱う", () => {
    expect(parseWeightOverrides("{")).toEqual({});
    expect(parseWeightOverrides("null")).toEqual({});
    expect(parseWeightOverrides("[1]")).toEqual({});
    expect(parseWeightOverrides("3")).toEqual({});
  });

  it("範囲外・数値でない値・知らない要素・知らないプリセットは捨てる", () => {
    const raw = JSON.stringify({
      solo: { pick: { meta: 2, counter: "x", synergy: -1, pro: 0.3, unknown: 0.5 } },
      team: { ban: { pro: null } },
      other: { pick: { meta: 0.5 } },
    });
    expect(parseWeightOverrides(raw)).toEqual({ solo: { pick: { pro: 0.3 } } });
  });
});
