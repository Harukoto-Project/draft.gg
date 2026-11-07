import { schedule, validate } from "node-cron";

import type { Logger } from "../logger/index.js";
import type { Job, JobRunner } from "../runner/index.js";

const TIMEZONE = "Asia/Tokyo";

export interface Scheduler {
  /** スケジュールを止める(実行中のジョブの完了は JobRunner.drain で待つ) */
  stop(): Promise<void>;
}

/** ジョブを cron で常駐実行する。runOnStart のジョブは起動直後にも1回実行する。schedule が null のジョブは登録しない。 */
export function startScheduler(jobs: Job[], runner: JobRunner, logger: Logger): Scheduler {
  const tasks = jobs.flatMap((job) => {
    if (job.schedule === null) return [];
    if (!validate(job.schedule)) {
      throw new Error(`cron 式が不正です: ${job.name} (${job.schedule})`);
    }

    const trigger = () => {
      runner.run(job).catch((error: unknown) => {
        // job_runs への記録自体に失敗した場合など。プロセスは止めず、次回の実行に任せる
        logger("error", "job runner failed", {
          job: job.name,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };

    const task = schedule(job.schedule, trigger, { timezone: TIMEZONE, name: job.name });
    logger("info", "job scheduled", { job: job.name, schedule: job.schedule, timezone: TIMEZONE });

    if (job.runOnStart) trigger();
    return [task];
  });

  return {
    async stop() {
      await Promise.all(tasks.map((task) => task.stop()));
    },
  };
}
