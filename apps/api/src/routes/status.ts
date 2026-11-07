import { STATUS_JOBS, statusResponseSchema } from "@draftgg/shared";
import type { StatusResponse } from "@draftgg/shared";
import { Hono } from "hono";

export interface StatusReader {
  getCurrentPatch(): Promise<string | null>;
  /** ジョブごとに、最後に成功して終わった時刻 */
  listLastSuccessfulRuns(jobs: readonly string[]): Promise<{ job: string; finishedAt: Date }[]>;
}

export function createStatusRoute(reader: StatusReader) {
  return new Hono().get("/", async (c) => {
    const [patch, runs] = await Promise.all([
      reader.getCurrentPatch(),
      reader.listLastSuccessfulRuns(STATUS_JOBS),
    ]);
    const finishedAt = new Map(runs.map((run) => [run.job, run.finishedAt.toISOString()]));

    const body: StatusResponse = statusResponseSchema.parse({
      patch,
      updatedAt: Object.fromEntries(STATUS_JOBS.map((job) => [job, finishedAt.get(job) ?? null])),
    });

    // 更新は数時間おき。短時間のキャッシュを許可する
    c.header("Cache-Control", "public, max-age=60");
    return c.json(body);
  });
}
