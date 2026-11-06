import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { loadConfig } from "./mod/config/index.js";
import { routes } from "./routes/index.js";

const config = loadConfig();

const app = new Hono().route("/api", routes);

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(
    JSON.stringify({ level: "info", msg: "api started", host: info.address, port: info.port }),
  );
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", msg: "api stopping", signal }));
  server.close((err) => {
    process.exit(err ? 1 : 0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
