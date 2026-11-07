import type { DamageType } from "./champion.js";
import type { Position } from "./position.js";
import type { ProStat } from "./pro.js";
import type { RankTier } from "./tier.js";

/** 提案計算に渡す、現在パッチの統計。率は 0〜1。 */
export interface StatsSnapshot {
  patch: string | null;
  tier: RankTier;
  champions: ChampionRef[];
  meta: MetaStat[];
  matchups: MatchupStat[];
  synergies: SynergyStat[];
  /** scope major のプロ統計。未集計なら空 */
  pro: ProStat[];
}

export interface ChampionRef {
  id: string;
  nameJa: string;
  nameEn: string;
  numericKey: number;
  damageType: DamageType | null;
}

export interface MetaStat {
  championId: string;
  position: Position;
  games: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  roleRate: number;
  /** OP.GG のティア(1=強い … 5=弱い) */
  tierRank: number;
}

export interface MatchupStat {
  championId: string;
  position: Position;
  opponentId: string;
  games: number;
  /** championId 側の勝率 */
  winRate: number;
}

export interface SynergyStat {
  championId: string;
  position: Position;
  allyId: string;
  allyPosition: Position;
  games: number;
  winRate: number;
  score: number;
}
