/** 取り込むランク帯。後から追加できるよう、設定値として並べる。 */
export const RANK_TIERS = ["diamond_plus"] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export const DEFAULT_RANK_TIER: RankTier = "diamond_plus";

/**
 * 主要ロールとみなす割合。そのチャンピオンの試合のうち、この割合以上を占めるロールだけ
 * 対面・シナジーを取り込む。メタの role_rate は 0〜1。
 */
export const MAJOR_ROLE_RATE = 0.1;
