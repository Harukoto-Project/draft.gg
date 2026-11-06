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
  /** 再試行の待ち。signal が中断されたら、待たずに戻る */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export type RunOutcome = "success" | "failed" | "skipped";

export interface JobRunner {
  /** ジョブを実行する。同じジョブが実行中なら何もせず "skipped" を返す */
  run(job: Job): Promise<RunOutcome>;
  /**
   * 再試行の待ちを中断し、以降の再試行を行わないようにする(停止時に使う)。
   * 実行中の job.run() は中断せず、その試行が終わるまで待つ。
   */
  cancelRetries(): void;
  /** 実行中のジョブがすべて終わるまで待つ(停止時に使う) */
  drain(): Promise<void>;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export function createJobRunner(options: RunnerOptions): JobRunner {
  const { store, logger } = options;
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 30_000;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? abortableSleep;

  // 多重起動の防止(worker は1プロセスのため、プロセス内で管理する)
  const running = new Map<string, Promise<RunOutcome>>();
  const retryAbort = new AbortController();

  /** 記録の更新に失敗しても、ジョブの結果や再試行には影響させない */
  async function finishQuietly(
    job: Job,
    runId: number,
    result: Parameters<JobRunStore["finish"]>[1],
  ): Promise<void> {
    try {
      await store.finish(runId, result);
    } catch (error) {
      logger("error", "failed to record job run", {
        job: job.name,
        runId,
        error: messageOf(error),
      });
    }
  }

  async function runWithRetry(job: Job): Promise<RunOutcome> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // start に失敗した試行は記録が無いため finish を呼ばず、失敗した試行と同じく待って再試行する
      let runId: number | null = null;
      try {
        runId = await store.start(job.name, now());
        const summary = await job.run();
        await finishQuietly(job, runId, { status: "success", finishedAt: now(), summary });
        logger("info", "job succeeded", { job: job.name, attempt, summary });
        return "success";
      } catch (error) {
        const message = messageOf(error);
        if (runId !== null) {
          await finishQuietly(job, runId, { status: "failed", finishedAt: now(), error: message });
        }
        logger("error", "job failed", { job: job.name, attempt, maxAttempts, error: message });
      }

      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 4 ** (attempt - 1), retryAbort.signal);
        if (retryAbort.signal.aborted) {
          logger("warn", "job retry cancelled", { job: job.name, attempt });
          break;
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

    cancelRetries() {
      retryAbort.abort();
    },

    async drain() {
      await Promise.allSettled(running.values());
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
