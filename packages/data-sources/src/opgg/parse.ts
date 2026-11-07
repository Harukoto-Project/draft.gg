import { POSITIONS } from "@draftgg/shared";
import type { ChampionRef, DamageType, Position } from "@draftgg/shared";
import { z } from "zod";

import { createNameIndex, createNumericIndex } from "./names.js";
import type { ChampionAnalysis, LaneMetaRow } from "./types.js";

const rateSchema = z.number().finite();

const laneEntrySchema = z.object({
  champion: z.union([z.string(), z.object({ name: z.string() })]),
  play: z.number().finite(),
  win_rate: rateSchema,
  pick_rate: rateSchema,
  ban_rate: rateSchema,
  role_rate: rateSchema,
  tier: z.number().int(),
});

const laneMetaSchema = z.object({
  data: z.object({
    positions: z.record(z.string(), z.array(laneEntrySchema)),
  }),
});

const counterSchema = z.object({
  champion_id: z.number().int(),
  my_win_rate: rateSchema,
  play: z.number().finite(),
});

const synergySchema = z.object({
  synergy_champion_id: z.number().int(),
  synergy_position: z.string(),
  play: z.number().finite(),
  win_rate: rateSchema,
  score: z.number().finite().optional(),
});

const analysisSchema = z.object({
  data: z.object({
    damage_type: z.string().optional(),
    summary: z.object({
      id: z.number().int(),
      average_stats: z.object({
        play: z.number().finite(),
        win_rate: rateSchema,
        pick_rate: rateSchema,
        ban_rate: rateSchema,
        tier: z.number().int(),
      }),
    }),
    strong_counters: z.array(counterSchema).optional(),
    weak_counters: z.array(counterSchema).optional(),
    synergies: z.record(z.string(), z.array(synergySchema)).optional(),
  }),
});

const DAMAGE_BY_OPGG: Record<string, DamageType> = {
  AD: "ad",
  AP: "ap",
  BOTH: "mixed",
};

/** MCP の tool 結果から JSON を取り出す。すでにオブジェクトならそのまま返す。 */
export function extractToolJson(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  if (!("content" in result) || !Array.isArray(result.content)) return result;

  const text = result.content
    .map((part) => {
      if (!part || typeof part !== "object" || !("text" in part)) return "";
      return typeof part.text === "string" ? part.text : "";
    })
    .join("");
  if (!text) {
    throw new Error("OP.GG の応答に本文がありません");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("OP.GG の応答を JSON として読めません");
  }
}

export function parseLaneMeta(payload: unknown, catalog: ChampionRef[]): LaneMetaRow[] {
  const parsed = laneMetaSchema.parse(payload);
  const names = createNameIndex(catalog);
  const rows: LaneMetaRow[] = [];
  const unknown: string[] = [];

  for (const [positionKey, entries] of Object.entries(parsed.data.positions)) {
    const position = parsePosition(positionKey);
    if (!position) continue;
    for (const entry of entries) {
      const label = championLabel(entry.champion);
      const champion = names.get(normalizeKey(label));
      if (!champion) {
        unknown.push(label);
        continue;
      }
      rows.push({
        championId: champion.id,
        position,
        games: nonNegativeInt(entry.play, label),
        winRate: normalizeRate(entry.win_rate, label),
        pickRate: normalizeRate(entry.pick_rate, label),
        banRate: normalizeRate(entry.ban_rate, label),
        roleRate: normalizeRate(entry.role_rate, label),
        tierRank: tierRankOf(entry.tier, label),
      });
    }
  }

  if (unknown.length > 0) {
    throw new Error(`チャンピオン名を対応付けできません: ${unknown.join(", ")}`);
  }
  return rows;
}

export function parseChampionAnalysis(
  payload: unknown,
  catalog: ChampionRef[],
  expected: { championId: string; position: Position; numericKey: number },
): ChampionAnalysis {
  const parsed = analysisSchema.parse(payload);
  if (parsed.data.summary.id !== expected.numericKey) {
    throw new Error(
      `OP.GG のチャンピオンIDが一致しません: 期待 ${expected.numericKey}、応答 ${parsed.data.summary.id}`,
    );
  }

  const stats = parsed.data.summary.average_stats;
  const label = expected.championId;
  const byNumeric = createNumericIndex(catalog);
  const matchups = new Map<string, ChampionAnalysis["matchups"][number]>();
  for (const counter of [
    ...(parsed.data.strong_counters ?? []),
    ...(parsed.data.weak_counters ?? []),
  ]) {
    const opponent = byNumeric.get(counter.champion_id);
    if (!opponent || opponent.id === expected.championId) continue;
    const next = {
      opponentId: opponent.id,
      games: nonNegativeInt(counter.play, label),
      winRate: normalizeRate(counter.my_win_rate, label),
    };
    const current = matchups.get(opponent.id);
    if (!current || next.games >= current.games) matchups.set(opponent.id, next);
  }

  const synergies: ChampionAnalysis["synergies"] = [];
  for (const entries of Object.values(parsed.data.synergies ?? {})) {
    for (const entry of entries) {
      const ally = byNumeric.get(entry.synergy_champion_id);
      const allyPosition = parsePosition(entry.synergy_position);
      if (!ally || !allyPosition || ally.id === expected.championId) continue;
      synergies.push({
        allyId: ally.id,
        allyPosition,
        games: nonNegativeInt(entry.play, label),
        winRate: normalizeRate(entry.win_rate, label),
        score: entry.score ?? 0,
      });
    }
  }

  const damage = parsed.data.damage_type?.toUpperCase();
  return {
    championId: expected.championId,
    position: expected.position,
    games: nonNegativeInt(stats.play, label),
    winRate: normalizeRate(stats.win_rate, label),
    pickRate: normalizeRate(stats.pick_rate, label),
    banRate: normalizeRate(stats.ban_rate, label),
    tierRank: tierRankOf(stats.tier, label),
    damageType: (damage && DAMAGE_BY_OPGG[damage]) || null,
    matchups: [...matchups.values()],
    synergies,
  };
}

function championLabel(champion: string | { name: string }): string {
  return typeof champion === "string" ? champion : champion.name;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeRate(value: number, label: string): number {
  if (value < 0) throw new Error(`率が不正です: ${label}`);
  const rate = value > 1 ? value / 100 : value;
  if (rate > 1) throw new Error(`率が不正です: ${label}`);
  return rate;
}

function nonNegativeInt(value: number, label: string): number {
  if (value < 0 || !Number.isFinite(value)) throw new Error(`試合数が不正です: ${label}`);
  return Math.round(value);
}

function tierRankOf(tier: number, label: string): number {
  if (tier < 1 || tier > 5) throw new Error(`ティアが不正です: ${label}`);
  return tier;
}

function parsePosition(value: string): Position | null {
  const normalized = value.toLowerCase();
  if (normalized === "bottom" || normalized === "bot") return "adc";
  for (const position of POSITIONS) {
    if (position === normalized) return position;
  }
  return null;
}
