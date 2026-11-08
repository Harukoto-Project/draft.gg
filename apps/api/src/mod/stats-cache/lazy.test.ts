import type { StatsSnapshot } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { createLazyStatsCache } from "./lazy.js";

function snapshotOf(patch: string): StatsSnapshot {
  return {
    patch,
    tier: "diamond_plus",
    champions: [],
    meta: [],
    matchups: [],
    synergies: [],
    pro: [],
  };
}

describe("createLazyStatsCache", () => {
  it("間隔内は読み直さず、過ぎたら読み直す", async () => {
    let time = 0;
    const load = vi
      .fn<() => Promise<StatsSnapshot>>()
      .mockResolvedValueOnce(snapshotOf("16.22"))
      .mockResolvedValueOnce(snapshotOf("16.23"));
    const cache = createLazyStatsCache(60_000, () => time);

    await cache.ensureFresh(load);
    time = 59_999;
    await cache.ensureFresh(load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.getSnapshot().patch).toBe("16.22");

    time = 60_000;
    await cache.ensureFresh(load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().patch).toBe("16.23");
  });

  it("読み込みに失敗しても、前回の統計を残す", async () => {
    let time = 0;
    const load = vi
      .fn<() => Promise<StatsSnapshot>>()
      .mockResolvedValueOnce(snapshotOf("16.22"))
      .mockRejectedValueOnce(new Error("DB に接続できない"));
    const cache = createLazyStatsCache(60_000, () => time);

    await cache.ensureFresh(load);
    time = 60_000;
    await cache.ensureFresh(load);

    expect(cache.getSnapshot().patch).toBe("16.22");
  });

  it("初回の読み込みに失敗したら、次のリクエストでもう一度読む", async () => {
    const load = vi
      .fn<() => Promise<StatsSnapshot>>()
      .mockRejectedValueOnce(new Error("DB に接続できない"))
      .mockResolvedValueOnce(snapshotOf("16.22"));
    const cache = createLazyStatsCache(60_000, () => 0);

    await cache.ensureFresh(load);
    expect(cache.getSnapshot().patch).toBeNull();
    await cache.ensureFresh(load);
    expect(cache.getSnapshot().patch).toBe("16.22");
  });

  it("更新中に来た別のリクエストは、読み込まずに古い統計を使う", async () => {
    let time = 0;
    let release: (value: StatsSnapshot) => void = () => undefined;
    const slow = new Promise<StatsSnapshot>((resolve) => {
      release = resolve;
    });
    const load = vi
      .fn<() => Promise<StatsSnapshot>>()
      .mockResolvedValueOnce(snapshotOf("16.22"))
      .mockReturnValueOnce(slow);
    const cache = createLazyStatsCache(60_000, () => time);

    await cache.ensureFresh(load);
    time = 60_000;
    const first = cache.ensureFresh(load);
    await cache.ensureFresh(load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().patch).toBe("16.22");

    release(snapshotOf("16.23"));
    await first;
    expect(cache.getSnapshot().patch).toBe("16.23");
  });
});
