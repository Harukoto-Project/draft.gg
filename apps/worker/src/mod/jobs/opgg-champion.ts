import { createOpggClient } from "@draftgg/data-sources";
import type { ChampionAnalysis, OpggTransport } from "@draftgg/data-sources";
import type { ChampionStatRow } from "@draftgg/db";
import { DEFAULT_RANK_TIER, MAJOR_ROLE_RATE } from "@draftgg/shared";
import type { ChampionRef } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export const OPGG_CHAMPION_SCHEDULE = "0 5 * * *";
export const OPGG_CALL_INTERVAL_MS = 3_000;
export const OPGG_CALL_ATTEMPTS = 3;

export interface MajorRoleTarget {
  championId: string;
  nameEn: string;
  numericKey: number;
  position: ChampionAnalysis["position"];
  roleRate: number;
}

export interface OpggChampionDeps {
  connect: () => Promise<OpggTransport>;
  listChampions: () => Promise<ChampionRef[]>;
  getCurrentPatch: () => Promise<string | null>;
  listTargets: () => Promise<MajorRoleTarget[]>;
  save: (input: {
    patch: string;
    tier: typeof DEFAULT_RANK_TIER;
    rows: ChampionStatRow[];
  }) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}

/** 毎日 05:00(ddragon のあと)に、主要ロールの対面とシナジーを1件ずつ取る。起動のたびに全件は呼ばない。 */
export function createOpggChampionJob(deps: OpggChampionDeps): Job {
  const sleep = deps.sleep ?? delay;

  return {
    name: "opgg-champion",
    schedule: OPGG_CHAMPION_SCHEDULE,
    runOnStart: false,
    async run() {
      const patch = await deps.getCurrentPatch();
      if (!patch) throw new Error("パッチが未取り込みです");

      const targets = await deps.listTargets();
      if (targets.length === 0) {
        throw new Error("主要ロールがありません。opgg-meta を先に実行してください");
      }

      const catalog = await deps.listChampions();
      const transport = await deps.connect();
      const client = createOpggClient(transport);
      try {
        const rows: ChampionStatRow[] = [];
        for (const [index, target] of targets.entries()) {
          if (index > 0) await sleep(OPGG_CALL_INTERVAL_MS);
          const analysis = await callWithRetry(
            () => client.analyzeChampion(catalog, target),
            sleep,
          );
          rows.push(toStatRow(analysis, target.roleRate));
        }
        await deps.save({ patch, tier: DEFAULT_RANK_TIER, rows });
        return {
          patch,
          tier: DEFAULT_RANK_TIER,
          champions: rows.length,
          minRoleRate: MAJOR_ROLE_RATE,
        };
      } finally {
        await client.close();
      }
    },
  };
}

async function callWithRetry<T>(
  run: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= OPGG_CALL_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (attempt < OPGG_CALL_ATTEMPTS) await sleep(OPGG_CALL_INTERVAL_MS);
    }
  }
  throw last instanceof Error ? last : new Error("OP.GG の呼び出しに失敗しました");
}

function toStatRow(analysis: ChampionAnalysis, roleRate: number): ChampionStatRow {
  return {
    championId: analysis.championId,
    position: analysis.position,
    games: analysis.games,
    winRate: analysis.winRate,
    pickRate: analysis.pickRate,
    banRate: analysis.banRate,
    roleRate,
    tierRank: analysis.tierRank,
    damageType: analysis.damageType,
    matchups: analysis.matchups,
    synergies: analysis.synergies,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
