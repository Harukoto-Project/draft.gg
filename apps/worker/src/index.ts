import { createDatabase, finishJobRun, startJobRun } from "@draftgg/db";

import { loadConfig } from "./mod/config/index.js";
import { createJobs } from "./mod/jobs/index.js";
import type { Job } from "./mod/runner/index.js";
import { log } from "./mod/logger/index.js";
import { createJobRunner } from "./mod/runner/index.js";
import { startScheduler } from "./mod/scheduler/index.js";

const config = loadConfig();
const { db, close } = createDatabase(config.databaseUrl);

const runner = createJobRunner({
  logger: log,
  store: {
    start: (job, startedAt) => startJobRun(db, job, startedAt),
    finish: (id, result) => finishJobRun(db, id, result),
  },
});

let jobs: Job[] = [];
jobs = createJobs(db, {
  onNewPatch() {
    const meta = jobs.find((job) => job.name === "opgg-meta");
    const champion = jobs.find((job) => job.name === "opgg-champion");
    runner.track(
      (async () => {
        if (!meta) return;
        const outcome = await runner.run(meta);
        // メタ一覧のロール割合が揃ってから、主要ロールの分析を前倒しする
        if (outcome === "success" && champion) await runner.run(champion);
      })(),
    );
  },
});
const scheduler = startScheduler(jobs, runner, log);
log("info", "worker started");

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  let exitCode = 0;
  try {
    await scheduler.stop();
    // 再試行の待ち(最大 2 分)で止まらないよう、待ちを中断してから実行中の試行の終了を待つ
    runner.cancelRetries();
    await runner.drain();
    await close();
  } catch (error) {
    exitCode = 1;
    log("error", "worker shutdown failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // シグナルのリスナーを登録しているため、明示的に終了しないとプロセスが残る
    process.exit(exitCode);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
