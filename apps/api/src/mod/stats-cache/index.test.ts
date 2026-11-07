import type { StatsSnapshot } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { createStatsCache } from "./index.js";

const snapshot: StatsSnapshot = {
  patch: "16.22",
  tier: "diamond_plus",
  champions: [],
  meta: [],
  matchups: [],
  synergies: [],
  pro: [],
};

describe("createStatsCache", () => {
  it("読み込みに失敗しても、前回の統計を残す", async () => {
    const load = vi
      .fn<() => Promise<StatsSnapshot>>()
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValueOnce(new Error("DB に接続できない"));
    const cache = createStatsCache(load);

    await cache.refresh();
    await cache.refresh();

    expect(cache.getSnapshot().patch).toBe("16.22");
  });
});
