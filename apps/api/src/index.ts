import { serve } from "@hono/node-server";
import { createDatabase, loadStatsSnapshot } from "@draftgg/db";
import { DEFAULT_RANK_TIER } from "@draftgg/shared";

import { createApp } from "./mod/app/index.js";
import { loadConfig } from "./mod/config/index.js";
import { createPoolSync } from "./mod/pool-sync/index.js";
import { createStatsCache } from "./mod/stats-cache/index.js";

const config = loadConfig();
const { db, close } = createDatabase(config.databaseUrl);
const stats = createStatsCache(() => loadStatsSnapshot(db, DEFAULT_RANK_TIER));
await stats.refresh();
stats.start();

const app = createApp({
  db,
  auth: config.auth,
  stats,
  poolSync: createPoolSync({ getSnapshot: () => stats.getSnapshot() }),
});

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(
    JSON.stringify({ level: "info", msg: "api started", host: info.address, port: info.port }),
  );
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", msg: "api stopping", signal }));
  stats.stop();
  server.close((err) => {
    void close().finally(() => process.exit(err ? 1 : 0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
