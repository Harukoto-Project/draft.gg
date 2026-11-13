import type { PoolEntry } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { PoolSyncError } from "../mod/pool-sync/index.js";
import type { PoolSync } from "../mod/pool-sync/index.js";
import { createPoolSyncRoute } from "./pool-sync.js";

const ENTRY: PoolEntry = {
  championId: "Ahri",
  position: "mid",
  source: "opgg",
  games: 30,
  winRate: 0.55,
  excluded: false,
};

const BODY = { riotId: "Faker#KR1", region: "KR", roles: ["mid"] };

function appWith(options: { sync?: PoolSync; now?: () => number } = {}) {
  const sync = options.sync ?? { fetch: vi.fn(async () => [ENTRY]) };
  const app = new Hono().route("/pool-sync", createPoolSyncRoute({ sync, now: options.now }));
  return { app, sync };
}

function post(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

describe("POST /pool-sync", () => {
  it("認証なしで、取得したプールを返す(キャッシュさせない)", async () => {
    const { app, sync } = appWith();
    const response = await app.request("/pool-sync", post(BODY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ entries: [ENTRY] });
    expect(sync.fetch).toHaveBeenCalledWith({
      riotId: "Faker#KR1",
      region: "KR",
      roles: ["mid"],
    });
  });

  it("roles は省略できる", async () => {
    const { app, sync } = appWith();
    await app.request("/pool-sync", post({ riotId: "Faker#KR1", region: "KR" }));
    expect(sync.fetch).toHaveBeenCalledWith({ riotId: "Faker#KR1", region: "KR", roles: [] });
  });

  it.each([
    {},
    { ...BODY, riotId: "no-tag" },
    { ...BODY, riotId: "a".repeat(40) + "#JP1" },
    { ...BODY, region: "XX" },
    { ...BODY, roles: ["mid", "mid"] },
    { ...BODY, roles: ["king"] },
  ])("入力が不正なら 400(OP.GG も呼ばず、回数にも数えない)", async (body) => {
    const { app, sync } = appWith();
    const response = await app.request("/pool-sync", post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(sync.fetch).not.toHaveBeenCalled();
  });

  it("本文が大きすぎると 413", async () => {
    const { app } = appWith();
    const response = await app.request("/pool-sync", post({ ...BODY, riotId: "a".repeat(5000) }));
    expect(response.status).toBe(413);
  });

  it("同じ IP が同じ Riot ID を続けて頼むと 429(Retry-After 付き)", async () => {
    const { app, sync } = appWith({ now: () => 0 });
    const headers = { "cf-connecting-ip": "203.0.113.1" };

    expect((await app.request("/pool-sync", post(BODY, headers))).status).toBe(200);
    const second = await app.request("/pool-sync", post(BODY, headers));

    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
    expect(await second.json()).toEqual({ error: "sync_too_soon", retryAfterSeconds: 60 });
    expect(sync.fetch).toHaveBeenCalledTimes(1);
  });

  it("別の Riot ID なら通るが、同じ IP は 10 分に 10 回まで", async () => {
    const { app, sync } = appWith({ now: () => 0 });
    const headers = { "cf-connecting-ip": "203.0.113.1" };

    for (let index = 0; index < 10; index += 1) {
      const body = { ...BODY, riotId: `Player${index}#JP1` };
      expect((await app.request("/pool-sync", post(body, headers))).status).toBe(200);
    }
    const over = await app.request("/pool-sync", post({ ...BODY, riotId: "Other#JP1" }, headers));

    expect(over.status).toBe(429);
    expect(Number(over.headers.get("Retry-After"))).toBe(600);
    expect(sync.fetch).toHaveBeenCalledTimes(10);
  });

  it("IP が違えば別々に数える。x-forwarded-for は先頭を使う", async () => {
    const { app } = appWith({ now: () => 0 });

    const a = await app.request(
      "/pool-sync",
      post(BODY, { "x-forwarded-for": "198.51.100.7, 10.0.0.1" }),
    );
    const b = await app.request("/pool-sync", post(BODY, { "x-forwarded-for": "198.51.100.8" }));
    const again = await app.request(
      "/pool-sync",
      post(BODY, { "x-forwarded-for": "198.51.100.7" }),
    );

    expect([a.status, b.status, again.status]).toEqual([200, 200, 429]);
  });

  it.each([
    ["invalid_riot_id", 400, "invalid_riot_id"],
    ["busy", 429, "busy"],
    ["unavailable", 502, "sync_failed"],
  ] as const)("取得の失敗 %s は %i と %s にする", async (code, status, error) => {
    const sync: PoolSync = {
      fetch: async () => {
        throw new PoolSyncError(code);
      },
    };
    const { app } = appWith({ sync });
    const response = await app.request("/pool-sync", post(BODY));

    expect(response.status).toBe(status);
    expect(((await response.json()) as { error: string }).error).toBe(error);
  });
});
