import type { Logger } from "../logger/index.js";
import type { Job, JobRunner, RunOutcome } from "../runner/index.js";

/** 取り込みの種類。ジョブ名の代わりに指定すると、含まれるジョブをまとめて実行する */
export const INGEST_GROUPS: Record<string, string[]> = {
  meta: ["ddragon", "opgg-meta", "opgg-champion"],
  pro: ["pro-oracles", "pro-leaguepedia", "pro-aggregate"],
  all: [],
};

/**
 * 実行するジョブを選ぶ。名前が無ければすべて、あれば指定したものだけ。
 * 名前には、ジョブ名のほか、グループ名(meta / pro / all)も使える。
 * 順番は指定順ではなく `jobs` の並び(createJobs の依存順)に揃える。
 * 例: ddragon → opgg-meta → opgg-champion、pro-oracles → pro-leaguepedia → pro-aggregate
 */
export function selectJobs(jobs: Job[], names: string[]): Job[] {
  if (names.length === 0) return jobs;

  const known = new Set(jobs.map((job) => job.name));
  const unknown = names.filter((name) => !known.has(name) && !Object.hasOwn(INGEST_GROUPS, name));
  if (unknown.length > 0) {
    throw new Error(
      `不明なジョブです: ${unknown.join(", ")}(ジョブは ${[...known].join(", ")}、種類は ${Object.keys(INGEST_GROUPS).join(", ")})`,
    );
  }
  const wanted = new Set<string>();
  for (const name of names) {
    if (name === "all") return jobs;
    if (Object.hasOwn(INGEST_GROUPS, name)) {
      INGEST_GROUPS[name]?.forEach((member) => wanted.add(member));
    } else {
      wanted.add(name);
    }
  }
  return jobs.filter((job) => wanted.has(job.name));
}

export interface IngestResult {
  job: string;
  outcome: RunOutcome;
}

/**
 * ジョブを順に1回ずつ実行する(再試行と job_runs への記録は runner に任せる)。
 * 1つが失敗しても残りは続け、結果を返す。中断(signal)されたら、以降は始めない。
 */
export async function runIngest(
  jobs: Job[],
  runner: JobRunner,
  logger: Logger,
  signal?: AbortSignal,
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const job of jobs) {
    if (signal?.aborted) {
      logger("warn", "ingest cancelled", { remaining: jobs.length - results.length });
      break;
    }
    logger("info", "ingest job start", { job: job.name });
    results.push({ job: job.name, outcome: await runner.run(job) });
  }
  return results;
}

/** 失敗(または未実行)のジョブがあれば true */
export function hasFailure(results: IngestResult[], expected: number): boolean {
  return results.length < expected || results.some((result) => result.outcome !== "success");
}
