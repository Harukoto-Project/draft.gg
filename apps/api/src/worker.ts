import { createDatabaseFromHyperdrive, loadStatsSnapshot } from "@draftgg/db";
import type { DatabaseConnection } from "@draftgg/db";
import { DEFAULT_RANK_TIER } from "@draftgg/shared";

import { createApp } from "./mod/app/index.js";
import { loadAuthConfig } from "./mod/config/index.js";
import { createPoolSync } from "./mod/pool-sync/index.js";
import { createLazyStatsCache } from "./mod/stats-cache/lazy.js";

/**
 * Cloudflare Workers の入口。Node の常駐サーバー(index.ts)と同じ Hono アプリを使う。
 * DB への接続はリクエストごとに作って閉じる(Workers では別リクエストの I/O を使い回せない)。
 * 統計と OP.GG 同期の回数の記録は、接続を持たない値なので isolate のメモリに置く。
 */
const stats = createLazyStatsCache();
const poolSync = createPoolSync({ getSnapshot: () => stats.getSnapshot() });

/** 統計を使わないパス(読み込みを省く) */
function needsStats(pathname: string): boolean {
  return pathname !== "/api/health" && !pathname.startsWith("/api/auth/");
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let connection: DatabaseConnection | undefined;
    try {
      const auth = loadAuthConfig({
        BETTER_AUTH_URL: env.BETTER_AUTH_URL,
        BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
        DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
      });
      connection = await createDatabaseFromHyperdrive(env.HYPERDRIVE);
      const { db } = connection;
      if (needsStats(new URL(request.url).pathname)) {
        await stats.ensureFresh(() => loadStatsSnapshot(db, DEFAULT_RANK_TIER));
      }
      return await createApp({ db, auth, stats, poolSync }).fetch(request, env, ctx);
    } catch (error) {
      // 設定の誤りや DB に接続できないときは、内容を返さず、ログにだけ残す
      console.log(
        JSON.stringify({
          level: "error",
          msg: "request failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return Response.json({ error: "internal_error" }, { status: 500 });
    } finally {
      if (connection) ctx.waitUntil(connection.close().catch(() => undefined));
    }
  },
} satisfies ExportedHandler<Env>;
