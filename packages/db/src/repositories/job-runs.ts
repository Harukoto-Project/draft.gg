import { and, eq, inArray, isNotNull, max } from "drizzle-orm";

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

/** ジョブごとに、最後に成功して終わった時刻。成功の記録が無いジョブは含まれない */
export async function listLastSuccessfulRuns(
  db: Database,
  jobs: readonly string[],
): Promise<{ job: string; finishedAt: Date }[]> {
  if (jobs.length === 0) return [];
  const rows = await db
    .select({ job: jobRuns.job, finishedAt: max(jobRuns.finishedAt) })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.status, "success"),
        isNotNull(jobRuns.finishedAt),
        inArray(jobRuns.job, [...jobs]),
      ),
    )
    .groupBy(jobRuns.job);
  return rows.flatMap((row) =>
    row.finishedAt ? [{ job: row.job, finishedAt: row.finishedAt }] : [],
  );
}
