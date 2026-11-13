export interface RateLimiter {
  /** 通すなら 0 を返して記録する。断るときは、通るまでの待ち秒数(1 以上)を返す */
  take(key: string): number;
  /** 記録しているキーの数(テスト用) */
  size(): number;
}

export interface RateLimiterOptions {
  windowMs: number;
  /** 窓の中で通す最大回数 */
  max: number;
  /** テストで時刻を固定する */
  now?: () => number;
  /** キーがこの数を超えたら、窓を過ぎたものを捨てる */
  maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 5000;

/** キーごとに、窓の中の通した時刻をメモリに持つ(プロセスを再起動すると消える)。断った試行は数えない */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const hits = new Map<string, number[]>();

  function recent(times: number[], at: number): number[] {
    return times.filter((time) => at - time < windowMs);
  }

  function prune(at: number): void {
    for (const [key, times] of hits) {
      const alive = recent(times, at);
      if (alive.length === 0) hits.delete(key);
      else hits.set(key, alive);
    }
  }

  return {
    take(key) {
      const at = now();
      const times = recent(hits.get(key) ?? [], at);
      if (times.length >= max) {
        hits.set(key, times);
        const oldest = times[0] ?? at;
        return Math.max(1, Math.ceil((oldest + windowMs - at) / 1000));
      }
      times.push(at);
      hits.set(key, times);
      if (hits.size > maxKeys) prune(at);
      return 0;
    },
    size: () => hits.size,
  };
}
