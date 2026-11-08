import type { StatsSnapshot } from "@draftgg/shared";

import { EMPTY_SNAPSHOT } from "./index.js";

/** 更新に失敗したまま居残った「更新中」の印を、無効とみなすまでの時間 */
const STUCK_REFRESH_MS = 30_000;

export interface LazyStatsCache {
  getSnapshot(): StatsSnapshot;
  /**
   * 古ければ読み直す。常駐タイマーを持てない Cloudflare Workers 用で、リクエストの中から呼ぶ。
   * 読み込みに失敗したときは前回の中身を残す。
   */
  ensureFresh(load: () => Promise<StatsSnapshot>): Promise<void>;
}

/**
 * 提案計算用の統計を、isolate のメモリに置く。
 * 別リクエストの I/O は使えないので、読み込みの Promise は共有せず、
 * 更新中に来た他のリクエストには(初回以外は)古い統計をそのまま返す。
 */
export function createLazyStatsCache(intervalMs = 60_000, now = Date.now): LazyStatsCache {
  let current = EMPTY_SNAPSHOT;
  let loadedAt: number | null = null;
  let refreshingSince: number | null = null;

  return {
    getSnapshot: () => current,
    async ensureFresh(load) {
      const startedAt = now();
      if (loadedAt !== null && startedAt - loadedAt < intervalMs) return;
      const refreshing = refreshingSince !== null && startedAt - refreshingSince < STUCK_REFRESH_MS;
      if (loadedAt !== null && refreshing) return;

      refreshingSince = startedAt;
      try {
        current = await load();
        loadedAt = now();
      } catch (error) {
        console.log(
          JSON.stringify({
            level: "error",
            msg: "stats cache refresh failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        refreshingSince = null;
      }
    },
  };
}
