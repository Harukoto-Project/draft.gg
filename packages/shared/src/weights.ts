/** 提案のプリセット。ソロは自分の枠があるとき、チームは5人分を見るとき。 */
export const PRESETS = ["solo", "team"] as const;

export type Preset = (typeof PRESETS)[number];

/** ピックの要素。プールと構成はデータが来るまで計算しない。プロは pro 統計があるとき計算する。 */
export const PICK_FACTORS = ["meta", "counter", "synergy", "pro", "pool", "composition"] as const;

export type PickFactor = (typeof PICK_FACTORS)[number];

export type PickWeights = Record<PickFactor, number>;

/** BANの要素。カウンターは自分側のピックへの脅威。 */
export const BAN_FACTORS = ["meta", "pro", "counter"] as const;

export type BanFactor = (typeof BAN_FACTORS)[number];

export type BanWeights = Record<BanFactor, number>;

/**
 * データが無い要素は計算時に外し、残りの重みを合計1にする。
 * データが無い要素(プロが未集計、プール・構成は未実装)は結果に効かない。
 */
export const PICK_WEIGHT_PRESETS: Record<Preset, PickWeights> = {
  solo: { meta: 0.3, counter: 0.3, synergy: 0.1, pro: 0.05, pool: 0.2, composition: 0.05 },
  team: { meta: 0.1, counter: 0.1, synergy: 0.25, pro: 0.25, pool: 0.05, composition: 0.25 },
};

export const BAN_WEIGHT_PRESETS: Record<Preset, BanWeights> = {
  solo: { meta: 0.45, pro: 0.1, counter: 0.45 },
  team: { meta: 0.3, pro: 0.35, counter: 0.35 },
};
