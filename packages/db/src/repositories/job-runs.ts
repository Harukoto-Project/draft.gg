import { eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { jobRuns } from "../schema/index.js";
import type { JobRunStatus } from "../schema/index.js";

/** ジョブの実行を記録し始める。戻り値は job_runs の id。 */
export async function startJobRun(db: Database, job: string, startedAt: Date): Promise<number> {
  const [result] = await db.insert(jobRuns).values({ job, status: "running", startedAt });
  return result.insertId;
}

export async function finishJobRun(
  db: Database,
  id: number,
  result: {
    status: Exclude<JobRunStatus, "running">;
    finishedAt: Date;
    summary?: Record<string, unknown>;
    error?: string;
  },
): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      status: result.status,
      finishedAt: result.finishedAt,
      summary: result.summary ?? null,
      error: result.error ?? null,
    })
    .where(eq(jobRuns.id, id));
}
