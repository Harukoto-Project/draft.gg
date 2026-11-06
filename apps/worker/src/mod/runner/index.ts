import type { Logger } from "../logger/index.js";
import type { Job, JobRunStore } from "./types.js";

export type { Job, JobRunStore } from "./types.js";

export interface RunnerOptions {
  store: JobRunStore;
  logger: Logger;
  /** 最大試行回数(初回を含む)。既定は 3 */
  maxAttempts?: number;
  /** 再試行の待ち時間の基準(ミリ秒)。試行ごとに 4 倍にする。既定は 30 秒 */
  baseDelayMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export type RunOutcome = "success" | "failed" | "skipped";

export interface JobRunner {
  /** ジョブを実行する。同じジョブが実行中なら何もせず "skipped" を返す */
  run(job: Job): Promise<RunOutcome>;
  /** 実行中のジョブがすべて終わるまで待つ(停止時に使う) */
  drain(): Promise<void>;
}

export function createJobRunner(options: RunnerOptions): JobRunner {
  const { store, logger } = options;
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 30_000;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  // 多重起動の防止(worker は1プロセスのため、プロセス内で管理する)
  const running = new Map<string, Promise<RunOutcome>>();

  async function runWithRetry(job: Job): Promise<RunOutcome> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const runId = await store.start(job.name, now());
      try {
        const summary = await job.run();
        await store.finish(runId, { status: "success", finishedAt: now(), summary });
        logger("info", "job succeeded", { job: job.name, attempt, summary });
        return "success";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.finish(runId, { status: "failed", finishedAt: now(), error: message });
        logger("error", "job failed", { job: job.name, attempt, maxAttempts, error: message });
        if (attempt < maxAttempts) {
          await sleep(baseDelayMs * 4 ** (attempt - 1));
        }
      }
    }
    return "failed";
  }

  return {
    run(job) {
      if (running.has(job.name)) {
        logger("warn", "job skipped: already running", { job: job.name });
        return Promise.resolve("skipped");
      }
      const promise = runWithRetry(job).finally(() => {
        running.delete(job.name);
      });
      running.set(job.name, promise);
      return promise;
    },

    async drain() {
      await Promise.allSettled(running.values());
    },
  };
}
