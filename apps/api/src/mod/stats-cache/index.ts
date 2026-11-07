import { DEFAULT_RANK_TIER } from "@draftgg/shared";
import type { StatsSnapshot } from "@draftgg/shared";

const EMPTY_SNAPSHOT: StatsSnapshot = {
  patch: null,
  tier: DEFAULT_RANK_TIER,
  champions: [],
  meta: [],
  matchups: [],
  synergies: [],
  pro: [],
};

export interface StatsCache {
  getSnapshot(): StatsSnapshot;
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
}

/**
 * 提案計算用の統計をメモリに置く。
 * worker の取り込み完了は、60秒ごとに DB を読み直して反映する。失敗したときは前回の中身を残す。
 */
export function createStatsCache(
  load: () => Promise<StatsSnapshot>,
  intervalMs = 60_000,
): StatsCache {
  let current = EMPTY_SNAPSHOT;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function refresh(): Promise<void> {
    try {
      current = await load();
    } catch (error) {
      console.log(
        JSON.stringify({
          level: "error",
          msg: "stats cache refresh failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return {
    getSnapshot: () => current,
    refresh,
    start() {
      timer = setInterval(() => void refresh(), intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
