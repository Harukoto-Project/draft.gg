import { BAN_WEIGHT_PRESETS, PICK_WEIGHT_PRESETS } from "@draftgg/shared";
import type { BanWeights, PickWeights, Preset, RecommendationRequest } from "@draftgg/shared";

export interface PresetWeights {
  pick: PickWeights;
  ban: BanWeights;
}

/** プリセットの初期値から変えたものだけを持つ */
export interface PresetOverrides {
  pick?: Partial<PickWeights>;
  ban?: Partial<BanWeights>;
}

export type WeightOverrides = Partial<Record<Preset, PresetOverrides>>;

export const WEIGHT_STEP = 0.05;
export const WEIGHT_MAX = 1;

export function defaultWeights(preset: Preset): PresetWeights {
  return { pick: PICK_WEIGHT_PRESETS[preset], ban: BAN_WEIGHT_PRESETS[preset] };
}

export function resolveWeights(preset: Preset, overrides: WeightOverrides): PresetWeights {
  const own = overrides[preset];
  return {
    pick: { ...PICK_WEIGHT_PRESETS[preset], ...own?.pick },
    ban: { ...BAN_WEIGHT_PRESETS[preset], ...own?.ban },
  };
}

function clampWeight(value: number): number {
  return Math.min(WEIGHT_MAX, Math.max(0, Math.round(value / WEIGHT_STEP) * WEIGHT_STEP));
}

function sameWeight(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** 1 つの重みを変える。初期値に戻ったら、上書きを外す */
export function setWeight(
  overrides: WeightOverrides,
  preset: Preset,
  kind: "pick",
  factor: keyof PickWeights,
  value: number,
): WeightOverrides;
export function setWeight(
  overrides: WeightOverrides,
  preset: Preset,
  kind: "ban",
  factor: keyof BanWeights,
  value: number,
): WeightOverrides;
export function setWeight(
  overrides: WeightOverrides,
  preset: Preset,
  kind: "pick" | "ban",
  factor: string,
  value: number,
): WeightOverrides {
  const defaults: Record<string, number> =
    kind === "pick" ? PICK_WEIGHT_PRESETS[preset] : BAN_WEIGHT_PRESETS[preset];
  const group: Record<string, number> = { ...overrides[preset]?.[kind] };
  const next = clampWeight(value);
  if (sameWeight(next, defaults[factor] ?? 0)) delete group[factor];
  else group[factor] = next;

  const own: PresetOverrides = { ...overrides[preset], [kind]: group };
  if (Object.keys(group).length === 0) delete own[kind];

  const result: WeightOverrides = { ...overrides, [preset]: own };
  if (!own.pick && !own.ban) delete result[preset];
  return result;
}

export function resetPreset(overrides: WeightOverrides, preset: Preset): WeightOverrides {
  const result = { ...overrides };
  delete result[preset];
  return result;
}

export function hasOverrides(overrides: WeightOverrides, preset: Preset): boolean {
  const own = overrides[preset];
  return Boolean(own?.pick || own?.ban);
}

/** 提案のリクエストに付ける重み。変えたものだけを送る。無ければ undefined */
export function requestWeights(
  preset: Preset,
  overrides: WeightOverrides,
): RecommendationRequest["weights"] {
  const own = overrides[preset];
  if (!own?.pick && !own?.ban) return undefined;
  return { ...(own.pick ? { pick: own.pick } : {}), ...(own.ban ? { ban: own.ban } : {}) };
}
