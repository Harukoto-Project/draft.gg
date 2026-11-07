import { POOL_SYNC_INTERVAL_MS } from "@draftgg/shared";
import type { PoolEntry, Profile } from "@draftgg/shared";
import type { ProfileStore } from "@draftgg/db";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthGateway } from "../mod/auth/index.js";
import { PoolSyncError } from "../mod/pool-sync/index.js";
import type { PoolSync } from "../mod/pool-sync/index.js";
import { createProfilesRoute } from "./profiles.js";

const OWNER = "owner-1";
const PROFILE_ID = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const OTHER_ID = "7f9619ff-8b86-4011-b42d-00c04fc964ff";

const BASE_PROFILE: Profile = {
  id: PROFILE_ID,
  displayName: "Faker",
  riotId: "Hide on bush#KR1",
  region: "KR",
  roles: ["mid"],
  syncedAt: null,
  pool: [],
};

function auth(userId: string | null): AuthGateway {
  return {
    handler: async () => new Response(null),
    getUser: async () => (userId ? { id: userId, name: "n", image: null } : null),
  };
}

function storeOf(profiles: Profile[]): ProfileStore {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    list: vi.fn(async () => [...byId.values()]),
    get: vi.fn(async (_owner, id) => byId.get(id) ?? null),
    create: vi.fn(async (_owner, input) => ({
      ...BASE_PROFILE,
      ...input,
      id: OTHER_ID,
      syncedAt: null,
      pool: [],
    })),
    update: vi.fn(async (_owner, id, patch) => {
      const current = byId.get(id);
      return current ? { ...current, ...patch } : null;
    }),
    remove: vi.fn(async (_owner, id) => byId.delete(id)),
    replacePool: vi.fn(async (_owner, id, entries) => {
      const current = byId.get(id);
      return current ? { ...current, pool: entries } : null;
    }),
    applySync: vi.fn(async (_owner, id, synced, syncedAt) => {
      const current = byId.get(id);
      return current ? { ...current, pool: synced, syncedAt: syncedAt.toISOString() } : null;
    }),
  };
}

const SYNCED: PoolEntry = {
  championId: "Ahri",
  position: "mid",
  source: "opgg",
  games: 30,
  winRate: 0.55,
  excluded: false,
};

function appWith(options: {
  store?: ProfileStore;
  sync?: PoolSync;
  userId?: string | null;
  now?: () => Date;
}) {
  const store = options.store ?? storeOf([BASE_PROFILE]);
  const sync = options.sync ?? { fetch: vi.fn(async () => [SYNCED]) };
  const userId = options.userId === undefined ? OWNER : options.userId;
  const app = new Hono().route(
    "/me/profiles",
    createProfilesRoute({ auth: auth(userId), store, sync, now: options.now }),
  );
  return { app, store, sync };
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("認証", () => {
  it("未ログインなら全エンドポイントが 401", async () => {
    const { app } = appWith({ userId: null });
    expect((await app.request("/me/profiles")).status).toBe(401);
    expect((await app.request("/me/profiles", json("POST", {}))).status).toBe(401);
    expect((await app.request(`/me/profiles/${PROFILE_ID}`, { method: "DELETE" })).status).toBe(
      401,
    );
  });

  it("操作は常にログイン中のユーザーの ID で行う", async () => {
    const { app, store } = appWith({});
    await app.request(`/me/profiles/${PROFILE_ID}`, json("PATCH", { displayName: "x" }));
    expect(store.update).toHaveBeenCalledWith(OWNER, PROFILE_ID, { displayName: "x" });
  });
});

describe("GET /me/profiles", () => {
  it("一覧を返し、キャッシュさせない", async () => {
    const { app } = appWith({});
    const response = await app.request("/me/profiles");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(((await response.json()) as { profiles: Profile[] }).profiles).toHaveLength(1);
  });
});

describe("POST /me/profiles", () => {
  const input = { displayName: " Chovy ", riotId: "Chovy#KR1", region: "KR", roles: ["mid"] };

  it("作成して 201 を返す(名前の前後の空白は取り除く)", async () => {
    const { app, store } = appWith({});
    const response = await app.request("/me/profiles", json("POST", input));
    expect(response.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith(OWNER, { ...input, displayName: "Chovy" });
  });

  it.each([
    { ...input, displayName: "" },
    { ...input, riotId: "no-tag" },
    { ...input, region: "XX" },
    { ...input, roles: ["mid", "mid"] },
  ])("入力が不正なら 400", async (body) => {
    const { app, store } = appWith({});
    const response = await app.request("/me/profiles", json("POST", body));
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("上限なら 409", async () => {
    const store = storeOf([]);
    vi.mocked(store.create).mockResolvedValueOnce("limit");
    const { app } = appWith({ store });
    expect((await app.request("/me/profiles", json("POST", input))).status).toBe(409);
  });

  it("本文が大きすぎると 413", async () => {
    const { app } = appWith({});
    const response = await app.request(
      "/me/profiles",
      json("POST", { ...input, displayName: "a".repeat(40_000) }),
    );
    expect(response.status).toBe(413);
  });
});

describe("PATCH / DELETE", () => {
  it("存在しない(または他人の)プレイヤーは 404", async () => {
    const { app } = appWith({});
    expect(
      (await app.request(`/me/profiles/${OTHER_ID}`, json("PATCH", { roles: [] }))).status,
    ).toBe(404);
    expect((await app.request(`/me/profiles/${OTHER_ID}`, { method: "DELETE" })).status).toBe(404);
  });

  it("ID の形が違えば 404(DELETE)・400(PATCH)", async () => {
    const { app } = appWith({});
    expect((await app.request("/me/profiles/abc", { method: "DELETE" })).status).toBe(404);
    expect((await app.request("/me/profiles/abc", json("PATCH", {}))).status).toBe(400);
  });

  it("削除したら 204", async () => {
    const { app } = appWith({});
    expect((await app.request(`/me/profiles/${PROFILE_ID}`, { method: "DELETE" })).status).toBe(
      204,
    );
  });
});

describe("PUT /me/profiles/:id/pool", () => {
  const entry: PoolEntry = { ...SYNCED, source: "manual", games: null, winRate: null };

  it("プールを置き換える", async () => {
    const { app, store } = appWith({});
    const response = await app.request(
      `/me/profiles/${PROFILE_ID}/pool`,
      json("PUT", { entries: [entry] }),
    );
    expect(response.status).toBe(200);
    expect(store.replacePool).toHaveBeenCalledWith(OWNER, PROFILE_ID, [entry]);
  });

  it("同じチャンピオン × ロールの重複は 400", async () => {
    const { app } = appWith({});
    const response = await app.request(
      `/me/profiles/${PROFILE_ID}/pool`,
      json("PUT", { entries: [entry, entry] }),
    );
    expect(response.status).toBe(400);
  });

  it("存在しないチャンピオンは 400", async () => {
    const store = storeOf([BASE_PROFILE]);
    vi.mocked(store.replacePool).mockResolvedValueOnce("unknown_champion");
    const { app } = appWith({ store });
    const response = await app.request(
      `/me/profiles/${PROFILE_ID}/pool`,
      json("PUT", { entries: [entry] }),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("unknown_champion");
  });
});

describe("POST /me/profiles/:id/sync", () => {
  const NOW = new Date("2026-11-07T12:00:00.000Z");

  it("OP.GG から取得したプールを反映する", async () => {
    const { app, store, sync } = appWith({ now: () => NOW });
    const response = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });
    const body = (await response.json()) as Profile;

    expect(response.status).toBe(200);
    expect(sync.fetch).toHaveBeenCalledWith({
      riotId: "Hide on bush#KR1",
      region: "KR",
      roles: ["mid"],
    });
    expect(store.applySync).toHaveBeenCalledWith(OWNER, PROFILE_ID, [SYNCED], NOW);
    expect(body.syncedAt).toBe(NOW.toISOString());
  });

  it("Riot ID かリージョンが無ければ 400", async () => {
    const store = storeOf([{ ...BASE_PROFILE, riotId: null }]);
    const { app, sync } = appWith({ store });
    const response = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });
    expect(response.status).toBe(400);
    expect(sync.fetch).not.toHaveBeenCalled();
  });

  it("前回の同期から最短間隔が過ぎていなければ 429(Retry-After 付き)", async () => {
    const syncedAt = new Date(NOW.getTime() - 60_000).toISOString();
    const { app, sync } = appWith({
      store: storeOf([{ ...BASE_PROFILE, syncedAt }]),
      now: () => NOW,
    });
    const response = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      String((POOL_SYNC_INTERVAL_MS - 60_000) / 1000),
    );
    expect(sync.fetch).not.toHaveBeenCalled();
  });

  it("失敗しても、すぐの再試行は 429 で断る", async () => {
    const sync: PoolSync = {
      fetch: vi.fn(async () => {
        throw new PoolSyncError("unavailable");
      }),
    };
    const { app } = appWith({ sync, now: () => NOW });

    const first = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });
    const second = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });

    expect(first.status).toBe(502);
    expect(second.status).toBe(429);
    expect(sync.fetch).toHaveBeenCalledTimes(1);
  });

  it("同時実行の上限なら 429、Riot ID が不正なら 400", async () => {
    for (const [code, status] of [
      ["busy", 429],
      ["invalid_riot_id", 400],
    ] as const) {
      const sync: PoolSync = {
        fetch: async () => {
          throw new PoolSyncError(code);
        },
      };
      const { app } = appWith({ sync });
      const response = await app.request(`/me/profiles/${PROFILE_ID}/sync`, { method: "POST" });
      expect(response.status).toBe(status);
    }
  });
});
