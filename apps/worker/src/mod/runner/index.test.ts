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
const noSleep = async (_ms: number, _signal?: AbortSignal) => {};

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
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 400]);
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

  it("drain は track した後続処理も待つ", async () => {
    const { store } = createFakeStore();
    const runner = createJobRunner({ store, logger: noopLogger, sleep: noSleep });
    let finished = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    runner.track(
      gate.then(() => {
        finished = true;
      }),
    );
    const drained = runner.drain();
    expect(finished).toBe(false);
    release();
    await drained;

    expect(finished).toBe(true);
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

  it("start が失敗しても finish は呼ばず、待ってから再試行する", async () => {
    const { store, runs } = createFakeStore();
    const finish = vi.spyOn(store, "finish");
    let starts = 0;
    const flakyStore: JobRunStore = {
      ...store,
      async start(job, startedAt) {
        starts += 1;
        if (starts === 1) throw new Error("DB に接続できない");
        return store.start(job, startedAt);
      },
    };
    const sleep = vi.fn(noSleep);
    const runner = createJobRunner({
      store: flakyStore,
      logger: noopLogger,
      sleep,
      baseDelayMs: 100,
    });

    const outcome = await runner.run(createJob(async () => ({})));

    expect(outcome).toBe("success");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100]);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(runs.map((r) => r.status)).toEqual(["success"]);
  });

  it("start が最後まで失敗したら、最大試行回数で failed を返す", async () => {
    const runner = createJobRunner({
      store: {
        async start() {
          throw new Error("DB に接続できない");
        },
        async finish() {
          throw new Error("呼ばれないはず");
        },
      },
      logger: noopLogger,
      sleep: noSleep,
      maxAttempts: 3,
    });
    const run = vi.fn(async () => ({}));

    const outcome = await runner.run(createJob(run));

    expect(outcome).toBe("failed");
    expect(run).not.toHaveBeenCalled();
  });

  it("finish が失敗しても、成功したジョブをやり直さない", async () => {
    const { store } = createFakeStore();
    const runner = createJobRunner({
      store: {
        start: store.start,
        async finish() {
          throw new Error("記録に失敗");
        },
      },
      logger: noopLogger,
      sleep: noSleep,
    });
    const run = vi.fn(async () => ({}));

    const outcome = await runner.run(createJob(run));

    expect(outcome).toBe("success");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("cancelRetries は再試行の待ちを中断し、以降の再試行をしない", async () => {
    const { store, runs } = createFakeStore();
    // 既定の sleep(abort で中断できる)を使い、長い待ちが中断されることを確認する
    const runner = createJobRunner({ store, logger: noopLogger, baseDelayMs: 60_000 });
    const run = vi.fn(async () => {
      throw new Error("取得に失敗");
    });

    const pending = runner.run(createJob(run));
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    // 1 回目の失敗の記録後、待ちに入るのを待つ
    await vi.waitFor(() => expect(runs[0]?.status).toBe("failed"));
    runner.cancelRetries();
    await runner.drain();

    expect(await pending).toBe("failed");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
