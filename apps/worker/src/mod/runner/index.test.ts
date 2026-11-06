import { describe, expect, it, vi } from "vitest";

import { createJobRunner } from "./index.js";
import type { Job, JobRunStore } from "./types.js";

function createFakeStore() {
  const runs: Array<{ job: string; status: string; summary?: unknown; error?: string }> = [];
  const store: JobRunStore = {
    async start(job) {
      runs.push({ job, status: "running" });
      return runs.length - 1;
    },
    async finish(id, result) {
      const run = runs[id];
      if (!run) throw new Error("unknown run");
      run.status = result.status;
      run.summary = result.summary;
      run.error = result.error;
    },
  };
  return { store, runs };
}

function createJob(run: Job["run"]): Job {
  return { name: "test-job", schedule: "* * * * *", runOnStart: false, run };
}

const noopLogger = vi.fn();
const noSleep = async () => {};

describe("createJobRunner", () => {
  it("成功した実行を job_runs に記録する", async () => {
    const { store, runs } = createFakeStore();
    const runner = createJobRunner({ store, logger: noopLogger, sleep: noSleep });

    const outcome = await runner.run(createJob(async () => ({ champions: 173 })));

    expect(outcome).toBe("success");
    expect(runs).toEqual([{ job: "test-job", status: "success", summary: { champions: 173 } }]);
  });

  it("失敗したら待ってから再試行し、成功すれば success を返す", async () => {
    const { store, runs } = createFakeStore();
    const sleep = vi.fn(noSleep);
    const runner = createJobRunner({
      store,
      logger: noopLogger,
      sleep,
      baseDelayMs: 100,
    });
    let calls = 0;

    const outcome = await runner.run(
      createJob(async () => {
        calls += 1;
        if (calls < 3) throw new Error("一時的なエラー");
        return {};
      }),
    );

    expect(outcome).toBe("success");
    expect(runs.map((r) => r.status)).toEqual(["failed", "failed", "success"]);
    // 指数バックオフ(基準 × 4 の累乗)
    expect(sleep.mock.calls).toEqual([[100], [400]]);
  });

  it("最大試行回数まで失敗したら failed を返し、エラーを記録する", async () => {
    const { store, runs } = createFakeStore();
    const runner = createJobRunner({ store, logger: noopLogger, sleep: noSleep, maxAttempts: 2 });

    const outcome = await runner.run(
      createJob(async () => {
        throw new Error("取得に失敗");
      }),
    );

    expect(outcome).toBe("failed");
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === "failed" && r.error === "取得に失敗")).toBe(true);
  });

  it("同じジョブが実行中なら多重起動せず skipped を返す", async () => {
    const { store, runs } = createFakeStore();
    const runner = createJobRunner({ store, logger: noopLogger, sleep: noSleep });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const job = createJob(async () => {
      await gate;
      return {};
    });

    const first = runner.run(job);
    const second = await runner.run(job);
    release();

    expect(second).toBe("skipped");
    expect(await first).toBe("success");
    expect(runs).toHaveLength(1);
  });

  it("drain は実行中のジョブの完了を待つ", async () => {
    const { store, runs } = createFakeStore();
    const runner = createJobRunner({ store, logger: noopLogger, sleep: noSleep });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    void runner.run(
      createJob(async () => {
        await gate;
        return {};
      }),
    );
    const drained = runner.drain();
    release();
    await drained;

    expect(runs[0]?.status).toBe("success");
  });
});
