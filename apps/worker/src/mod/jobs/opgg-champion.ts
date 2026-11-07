import { createOpggClient } from "@draftgg/data-sources";
import type { ChampionAnalysis, OpggTransport } from "@draftgg/data-sources";
import type { ChampionStatRow } from "@draftgg/db";
import { DEFAULT_RANK_TIER, MAJOR_ROLE_RATE } from "@draftgg/shared";
import type { ChampionRef } from "@draftgg/shared";

import type { Job } from "../runner/index.js";

export const OPGG_CHAMPION_SCHEDULE = "0 5 * * *";
export const OPGG_CALL_INTERVAL_MS = 3_000;
export const OPGG_CALL_ATTEMPTS = 3;
/** 取得に失敗してスキップしてよい割合(%)。超えたら保存せずジョブを失敗にする */
export const OPGG_MAX_SKIP_PERCENT = 10;
/** 1回の実行が十数分かかるため、失敗時のやり直しは1回までにして OP.GG への呼び出しを抑える */
export const OPGG_CHAMPION_MAX_ATTEMPTS = 2;
/** summary に残すスキップ対象の最大件数 */
const SKIPPED_SUMMARY_LIMIT = 20;

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
  /** 待ち。signal が中断されたら、待たずに戻る */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * 毎日 05:00(ddragon のあと)に、主要ロールの対面とシナジーを1件ずつ取る。起動のたびに全件は呼ばない。
 * 1件の失敗はスキップし、失敗が多いときだけジョブを失敗にする(スキップした分は前回の値が残る)。
 * 停止要求(signal)があれば、保存せずに中断する。
 */
export function createOpggChampionJob(deps: OpggChampionDeps): Job {
  const sleep = deps.sleep ?? delay;

  return {
    name: "opgg-champion",
    schedule: OPGG_CHAMPION_SCHEDULE,
    runOnStart: false,
    maxAttempts: OPGG_CHAMPION_MAX_ATTEMPTS,
    async run(signal) {
      const patch = await deps.getCurrentPatch();
      if (!patch) throw new Error("パッチが未取り込みです");

      const targets = await deps.listTargets();
      if (targets.length === 0) {
        throw new Error("主要ロールがありません。opgg-meta を先に実行してください");
      }
      const maxSkipped = Math.floor((targets.length * OPGG_MAX_SKIP_PERCENT) / 100);

      const catalog = await deps.listChampions();
      throwIfAborted(signal);
      const transport = await deps.connect();
      const client = createOpggClient(transport);
      try {
        const rows: ChampionStatRow[] = [];
        const skipped: string[] = [];
        for (const [index, target] of targets.entries()) {
          throwIfAborted(signal);
          if (index > 0) await sleep(OPGG_CALL_INTERVAL_MS, signal);
          throwIfAborted(signal);
          try {
            const analysis = await callWithRetry(
              () => client.analyzeChampion(catalog, target),
              sleep,
              signal,
            );
            rows.push(toStatRow(analysis, target.roleRate));
          } catch (error) {
            throwIfAborted(signal);
            skipped.push(`${target.championId}:${target.position}`);
            if (skipped.length > maxSkipped) {
              throw new Error(
                `取得に失敗した件数が上限(${OPGG_MAX_SKIP_PERCENT}%)を超えたため、保存を中止しました` +
                  `(${skipped.length}/${targets.length} 件、直近のエラー: ${messageOf(error)})`,
              );
            }
          }
        }
        throwIfAborted(signal);
        await deps.save({ patch, tier: DEFAULT_RANK_TIER, rows });
        return {
          patch,
          tier: DEFAULT_RANK_TIER,
          champions: rows.length,
          skipped: skipped.length,
          skippedTargets: skipped.slice(0, SKIPPED_SUMMARY_LIMIT),
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
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>,
  signal: AbortSignal | undefined,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= OPGG_CALL_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (attempt < OPGG_CALL_ATTEMPTS) {
        await sleep(OPGG_CALL_INTERVAL_MS, signal);
        if (signal?.aborted) break;
      }
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

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("停止要求のため中断しました(保存していません)");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
