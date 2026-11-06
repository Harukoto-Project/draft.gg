import { createDatabase, finishJobRun, startJobRun } from "@draftgg/db";

import { loadConfig } from "./mod/config/index.js";
import { createJobs } from "./mod/jobs/index.js";
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

const scheduler = startScheduler(createJobs(db), runner, log);
log("info", "worker started");

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  await scheduler.stop();
  await runner.drain();
  await close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
