import { z } from "zod";

import type { Side } from "./draft.js";
import { POSITIONS } from "./position.js";
import type { Position } from "./position.js";

/** プロ統計の対象リーグ。LTA North / LTA South と旧 LCS は LTA にまとめる。 */
export const PRO_LEAGUES = ["LCK", "LPL", "LEC", "LTA", "MSI", "Worlds", "FirstStand"] as const;

export type ProLeague = (typeof PRO_LEAGUES)[number];

export function isProLeague(value: string): value is ProLeague {
  return (PRO_LEAGUES as readonly string[]).includes(value);
}

/** エンジンが読む、対象リーグ合算の scope */
export const PRO_SCOPE_MAJOR = "major";

/** この試合数未満のパッチは、直近パッチの候補にしない */
export const MIN_PRO_GAMES_PER_PATCH = 20;

/** major とリーグ別 scope に含めるパッチ数 */
export const PRO_WINDOW_PATCHES = 2;

/**
 * 第2BANより前のピック(順番 1〜6)を序盤とする。
 * 大会形式の第1ピックフェーズ(B1 / R1 R2 / B2 B3 / R3)に相当する。
 */
export const EARLY_PICK_THROUGH = 6;

export const PRO_ACTION_TYPES = ["pick", "ban"] as const;

export type ProActionType = (typeof PRO_ACTION_TYPES)[number];

export interface ProGameSources {
  oraclesElixir: boolean;
  leaguepedia: boolean;
}

export interface ProDraftAction {
  side: Side;
  type: ProActionType;
  /** ドラフト全体での順番。不明なら null */
  order: number | null;
  /** ピックだけ。BAN は null */
  position: Position | null;
  championId: string;
}

export interface ProGameDraft {
  gameKey: string;
  league: ProLeague;
  event: string;
  playedAt: Date;
  gameNumber: string;
  patch: string;
  blueTeam: string;
  redTeam: string;
  winnerSide: Side;
  actions: ProDraftAction[];
}

/** 提案スナップショットに載せる、scope major の1行 */
export interface ProStat {
  championId: string;
  position: Position;
  /** その scope の試合数(プレゼンスの分母) */
  games: number;
  picks: number;
  /** チャンピオン全体の BAN 数。ロール別の行に同じ値を置く */
  bans: number;
  presence: number;
  winRate: number | null;
  earlyPickRate: number | null;
}

export interface ProChampionStatRow extends ProStat {
  scope: string;
  computedAt: Date;
}

export function proStatsScope(league?: ProLeague, patch?: string): string {
  if (league && patch) return `league:${league}:patch:${patch}`;
  if (league) return `league:${league}`;
  if (patch) return `patch:${patch}`;
  return PRO_SCOPE_MAJOR;
}

/** "16.01" を "16.1" にそろえる。解釈できないときは null */
export function normalizePatch(value: string): string | null {
  const match = /^(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}`;
}

/** "16.9" より "16.10" が新しい、という順 */
export function comparePatchDesc(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (right[index] ?? 0) - (left[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function selectRecentProPatches(counts: { patch: string; games: number }[]): string[] {
  return counts
    .filter((count) => count.games >= MIN_PRO_GAMES_PER_PATCH)
    .map((count) => count.patch)
    .sort(comparePatchDesc)
    .slice(0, PRO_WINDOW_PATCHES);
}

export function proMatchDate(playedAt: Date): string {
  return playedAt.toISOString().slice(0, 10);
}

const patchQuery = z.string().regex(/^\d+\.\d+$/);

export const proChampionsQuerySchema = z.object({
  league: z.enum(PRO_LEAGUES).optional(),
  patch: patchQuery.optional(),
});

export const proChampionsResponseSchema = z.object({
  scope: z.string(),
  patches: z.array(z.string()),
  stats: z.array(
    z.object({
      championId: z.string(),
      nameJa: z.string(),
      position: z.enum(POSITIONS),
      games: z.number(),
      picks: z.number(),
      bans: z.number(),
      presence: z.number(),
      winRate: z.number().nullable(),
      earlyPickRate: z.number().nullable(),
    }),
  ),
});

export type ProChampionsResponse = z.infer<typeof proChampionsResponseSchema>;
