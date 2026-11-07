import { describe, expect, it, vi } from "vitest";

import type { Job, JobRunner } from "../runner/index.js";
import { hasFailure, runIngest, selectJobs } from "./index.js";

function job(name: string): Job {
  return { name, schedule: null, runOnStart: false, run: async () => ({}) };
}

const jobs = [job("ddragon"), job("opgg-meta"), job("opgg-champion")];

describe("selectJobs", () => {
  it("名前が無ければすべてを返す", () => {
    expect(selectJobs(jobs, [])).toBe(jobs);
  });

  it("指定した順ではなく、依存順に並べる", () => {
    const names = selectJobs(jobs, ["opgg-champion", "ddragon"]).map((j) => j.name);
    expect(names).toEqual(["ddragon", "opgg-champion"]);
  });

  it("重複した指定は1回にする", () => {
    expect(selectJobs(jobs, ["ddragon", "ddragon"])).toHaveLength(1);
  });

  it("不明な名前はエラーにして、指定できる名前を示す", () => {
    expect(() => selectJobs(jobs, ["nope"])).toThrow(/nope.*ddragon, opgg-meta, opgg-champion/);
  });
});

describe("runIngest", () => {
  function createRunner(outcomes: Record<string, "success" | "failed" | "skipped">): JobRunner {
    return {
      run: vi.fn(async (target: Job) => outcomes[target.name] ?? "success"),
      abort: vi.fn(),
      drain: vi.fn(),
      track: vi.fn(),
    };
  }

  it("順に実行し、1つ失敗しても残りを続ける", async () => {
    const runner = createRunner({ "opgg-meta": "failed" });

    const results = await runIngest(jobs, runner, vi.fn());

    expect(results).toEqual([
      { job: "ddragon", outcome: "success" },
      { job: "opgg-meta", outcome: "failed" },
      { job: "opgg-champion", outcome: "success" },
    ]);
    expect(hasFailure(results, jobs.length)).toBe(true);
  });

  it("中断されたら、以降のジョブは始めない", async () => {
    const stop = new AbortController();
    const runner = createRunner({});
    vi.mocked(runner.run).mockImplementationOnce(async () => {
      stop.abort();
      return "success";
    });

    const results = await runIngest(jobs, runner, vi.fn(), stop.signal);

    expect(results).toEqual([{ job: "ddragon", outcome: "success" }]);
    expect(hasFailure(results, jobs.length)).toBe(true);
  });
});

describe("hasFailure", () => {
  it("すべて成功なら false", () => {
    expect(hasFailure([{ job: "a", outcome: "success" }], 1)).toBe(false);
  });

  it("skipped は失敗として扱う", () => {
    expect(hasFailure([{ job: "a", outcome: "skipped" }], 1)).toBe(true);
  });
});
