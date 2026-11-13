import {
  BAN_FACTORS,
  BAN_WEIGHT_PRESETS,
  PICK_FACTORS,
  PICK_WEIGHT_PRESETS,
  POSITIONS,
  SIDES,
} from "@draftgg/shared";
import type {
  BanWeights,
  DraftState,
  PickWeights,
  PoolHintEntry,
  PoolHints,
  Position,
  Preset,
  Side,
  StatsSnapshot,
} from "@draftgg/shared";

import { recommend } from "../recommend.js";
import { Random } from "./random.js";
import { fullSnapshot, plainSnapshot, sparseSnapshot, tiedSnapshot } from "./snapshots.js";

/** Rust 側が読む golden の 1 件。入力と、TS 版 engine の出力 */
export interface GoldenScenario {
  name: string;
  snapshot: string;
  draft: DraftState;
  preset: Preset;
  limit: number;
  pickWeights: PickWeights;
  banWeights: BanWeights;
  pools?: PoolHints;
  expected: ReturnType<typeof recommend>;
}

export interface GoldenFile {
  snapshots: Record<string, StatsSnapshot>;
  scenarios: GoldenScenario[];
}

const WEIGHT_CHOICES = [0, 0.1, 0.5, 1] as const;
const SCENARIOS_PER_SNAPSHOT = 45;

function emptyAssignment(): DraftState["assignments"]["blue"] {
  return { top: null, jungle: null, mid: null, adc: null, support: null };
}

function randomDraft(random: Random, ids: readonly string[]): DraftState {
  const mySide = random.pick(SIDES);
  // 統計に無いチャンピオンが混ざっても動くことを確かめる
  const pool = random.shuffle(random.chance(0.1) ? [...ids, "NotInSnapshot"] : ids);

  const actions: DraftState["actions"] = [];
  const count = random.between(0, 16);
  for (let step = 0; step < count; step += 1) {
    const championId = random.chance(0.05) ? null : (pool.shift() ?? null);
    actions.push({
      step,
      type: random.chance(0.4) ? "ban" : "pick",
      side: random.pick(SIDES),
      championId,
    });
  }

  const assignments = { blue: emptyAssignment(), red: emptyAssignment() };
  const assigned = new Set<string>();
  for (const side of SIDES) {
    const picked = actions
      .filter((action) => action.side === side && action.type === "pick" && action.championId)
      .map((action) => action.championId as string);
    for (const position of random.shuffle(POSITIONS)) {
      if (!random.chance(0.35)) continue;
      // 多くはピック済みから、まれにピックされていないチャンピオンを割り当てる
      const candidate = random.chance(0.9) ? picked.shift() : pool.shift();
      if (candidate && !assigned.has(candidate)) {
        assigned.add(candidate);
        assignments[side][position] = candidate;
      }
    }
  }

  const draft: DraftState = {
    format: random.chance(0.5) ? "ranked" : "tournament",
    mySide,
    actions,
    assignments,
  };
  if (random.chance(0.6)) draft.me = { side: mySide, position: random.pick(POSITIONS) };
  return draft;
}

function randomPools(random: Random, ids: readonly string[]): PoolHints | undefined {
  if (!random.chance(0.35)) return undefined;
  const pools: PoolHints = {};
  const positions: Position[] = random.shuffle(POSITIONS).slice(0, random.between(1, 3));
  for (const position of positions) {
    const entries: PoolHintEntry[] = random
      .shuffle(ids)
      .slice(0, random.between(0, 6))
      .map((championId) => {
        if (random.chance(0.25)) return { championId, games: null, winRate: null };
        // 片方だけ無い入力も、手動登録として扱われる
        if (random.chance(0.05)) return { championId, games: random.between(0, 50), winRate: null };
        return {
          championId,
          games: random.between(0, 100),
          winRate: Math.round(random.next() * 1000) / 1000,
        };
      });
    pools[position] = entries;
  }
  return pools;
}

function randomWeights<T extends string>(
  random: Random,
  factors: readonly T[],
  base: Record<T, number>,
): Record<T, number> {
  const weights = { ...base };
  if (!random.chance(0.35)) return weights;
  for (const factor of factors) {
    if (random.chance(0.4)) weights[factor] = random.pick(WEIGHT_CHOICES);
  }
  return weights;
}

function scenariosFor(name: string, snapshot: StatsSnapshot, seed: number): GoldenScenario[] {
  const random = new Random(seed);
  const ids = snapshot.champions.map((champion) => champion.id);
  const scenarios: GoldenScenario[] = [];

  for (let index = 0; index < SCENARIOS_PER_SNAPSHOT; index += 1) {
    const draft = randomDraft(random, ids);
    // 自分の枠の有無とプリセットは、食い違う組み合わせも試す
    const preset: Preset = random.chance(0.85)
      ? draft.me
        ? "solo"
        : "team"
      : random.pick(["solo", "team"]);
    const input = {
      draft,
      snapshot,
      preset,
      limit: random.between(1, 12),
      pickWeights: randomWeights(random, PICK_FACTORS, PICK_WEIGHT_PRESETS[preset]),
      banWeights: randomWeights(random, BAN_FACTORS, BAN_WEIGHT_PRESETS[preset]),
      pools: randomPools(random, ids),
    };
    scenarios.push({
      name: `${name}-${index}`,
      snapshot: name,
      draft: input.draft,
      preset: input.preset,
      limit: input.limit,
      pickWeights: input.pickWeights,
      banWeights: input.banWeights,
      ...(input.pools ? { pools: input.pools } : {}),
      expected: recommend(input),
    });
  }
  return scenarios;
}

/** 固定のシードで作るので、毎回同じ内容になる。変えたら golden の更新が必要 */
export function buildGolden(): GoldenFile {
  const snapshots: Record<string, StatsSnapshot> = {
    full: fullSnapshot(),
    sparse: sparseSnapshot(),
    tied: tiedSnapshot(),
    plain: plainSnapshot(),
  };
  const scenarios = Object.entries(snapshots).flatMap(([name, snapshot], index) =>
    scenariosFor(name, snapshot, 1000 + index),
  );
  return { snapshots, scenarios };
}

export type { Side };
