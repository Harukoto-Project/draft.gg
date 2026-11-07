import { resolve } from "node:path";

import { createDatabase, finishJobRun, startJobRun } from "@draftgg/db";

import { loadConfig } from "./mod/config/index.js";
import { parseIngestArgs } from "./mod/ingest/args.js";
import { hasFailure, runIngest, selectJobs } from "./mod/ingest/index.js";
import { createJobs } from "./mod/jobs/index.js";
import { log } from "./mod/logger/index.js";
import { createJobRunner } from "./mod/runner/index.js";

/**
 * データの取り込みを1回だけ実行する(常駐のスケジューラは起動しない)。
 * 使い方: `pnpm ingest [ジョブ名または種類...] [--csv <パス>]`。名前を省くとすべてを依存順に実行する。
 * 種類は meta(ddragon / opgg-meta / opgg-champion)、pro(pro-oracles / pro-leaguepedia / pro-aggregate)、all。
 * --csv は、pro-oracles が Oracle's Elixir のローカルの CSV を読む。
 */
async function main(): Promise<number> {
  const args = parseIngestArgs(process.argv.slice(2));
  const config = loadConfig();
  const { db, close } = createDatabase(config.databaseUrl);

  const runner = createJobRunner({
    logger: log,
    store: {
      start: (job, startedAt) => startJobRun(db, job, startedAt),
      finish: (id, result) => finishJobRun(db, id, result),
    },
  });

  const stop = new AbortController();
  // Ctrl+C で、再試行の待ちと実行中のジョブを中断し、以降のジョブは始めない
  process.on("SIGINT", () => {
    log("warn", "ingest stopping", { signal: "SIGINT" });
    stop.abort();
    runner.abort();
  });

  try {
    // 新パッチなどの連鎖(onNewPatch など)は付けず、依存順の逐次実行で代える
    const jobs = selectJobs(
      createJobs(db, {
        leaguepedia: config.leaguepedia,
        oraclesFileUrl: config.oraclesFileUrl,
        // 相対パスは、pnpm を実行したディレクトリ(リポジトリのルート)から解決する
        oraclesFilePath: args.csvPath
          ? resolve(process.env.INIT_CWD ?? process.cwd(), args.csvPath)
          : undefined,
      }),
      args.targets,
    );
    if (args.csvPath && !jobs.some((job) => job.name === "pro-oracles")) {
      throw new Error("--csv は pro-oracles を実行するときだけ指定できます(例: pnpm ingest pro)");
    }
    log("info", "ingest started", { jobs: jobs.map((job) => job.name) });

    const results = await runIngest(jobs, runner, log, stop.signal);
    const failed = hasFailure(results, jobs.length);
    log(failed ? "error" : "info", failed ? "ingest finished with failures" : "ingest finished", {
      results,
    });
    return failed ? 1 : 0;
  } finally {
    await runner.drain();
    await close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    log("error", "ingest failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  },
);
