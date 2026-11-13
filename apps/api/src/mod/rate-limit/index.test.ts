import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./index.js";

describe("createRateLimiter", () => {
  it("窓の中の上限までは通し、超えたら待ち秒数を返す", () => {
    let at = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => at });

    expect(limiter.take("a")).toBe(0);
    at += 10_000;
    expect(limiter.take("a")).toBe(0);
    at += 10_000;
    // 最も古い記録(0ms)が窓から出るのは 60_000ms。いまは 20_000ms なので 40 秒
    expect(limiter.take("a")).toBe(40);
  });

  it("待ち時間が過ぎたら、再び通る", () => {
    let at = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => at });
    limiter.take("a");
    expect(limiter.take("a")).toBeGreaterThan(0);

    at += 60_000;
    expect(limiter.take("a")).toBe(0);
  });

  it("断った試行は数えない(待てば通る)", () => {
    let at = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => at });
    limiter.take("a");
    at += 30_000;
    limiter.take("a");
    limiter.take("a");

    at += 30_000;
    expect(limiter.take("a")).toBe(0);
  });

  it("キーごとに別々に数える", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 });
    expect(limiter.take("a")).toBe(0);
    expect(limiter.take("b")).toBe(0);
    expect(limiter.take("a")).toBeGreaterThan(0);
  });

  it("記録するキーが増えすぎたら、窓を過ぎたものを捨てる", () => {
    let at = 0;
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1, now: () => at, maxKeys: 3 });
    limiter.take("a");
    limiter.take("b");
    limiter.take("c");
    at += 2_000;
    limiter.take("d");

    expect(limiter.size()).toBe(1);
  });
});
