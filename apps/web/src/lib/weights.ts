import {
  BAN_FACTORS,
  BAN_WEIGHT_PRESETS,
  PICK_FACTORS,
  PICK_WEIGHT_PRESETS,
  PRESETS,
} from "@draftgg/shared";
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

function pickGroup(value: unknown, factors: readonly string[]): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result: Record<string, number> = {};
  for (const factor of factors) {
    const item = (value as Record<string, unknown>)[factor];
    if (typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= WEIGHT_MAX) {
      result[factor] = item;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 保存した文字列を読む。壊れた値や知らない要素は捨てる */
export function parseWeightOverrides(raw: string): WeightOverrides {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};

  const result: WeightOverrides = {};
  for (const preset of PRESETS) {
    const own = (data as Record<string, unknown>)[preset];
    if (typeof own !== "object" || own === null) continue;
    const pick = pickGroup((own as Record<string, unknown>).pick, PICK_FACTORS);
    const ban = pickGroup((own as Record<string, unknown>).ban, BAN_FACTORS);
    if (!pick && !ban) continue;
    result[preset] = {
      ...(pick ? { pick } : {}),
      ...(ban ? { ban } : {}),
    } as PresetOverrides;
  }
  return result;
}

/** 重みの合計が 0 だと、その要素の候補が出なくなる */
export function weightsTotal(weights: Readonly<Record<string, number>>): number {
  return Object.values(weights).reduce((sum, value) => sum + value, 0);
}
