import { serve } from "@hono/node-server";
import { createDatabase, getCurrentPatch, listChampions, loadStatsSnapshot } from "@draftgg/db";
import { DEFAULT_RANK_TIER } from "@draftgg/shared";
import { Hono } from "hono";

import { loadConfig } from "./mod/config/index.js";
import { createStatsCache } from "./mod/stats-cache/index.js";
import { createRoutes } from "./routes/index.js";

const config = loadConfig();
const { db, close } = createDatabase(config.databaseUrl);
const stats = createStatsCache(() => loadStatsSnapshot(db, DEFAULT_RANK_TIER));
await stats.refresh();
stats.start();

const app = new Hono().route(
  "/api",
  createRoutes({
    champions: {
      getCurrentPatch: () => getCurrentPatch(db),
      listChampions: () => listChampions(db),
    },
    meta: stats,
    recommendations: stats,
  }),
);

// 想定外のエラーは内容を返さず、ログにだけ残す
app.onError((error, c) => {
  console.log(JSON.stringify({ level: "error", msg: "request failed", error: error.message }));
  return c.json({ error: "internal_error" }, 500);
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
