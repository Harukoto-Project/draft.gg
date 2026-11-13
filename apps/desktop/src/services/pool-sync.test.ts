import type { Profile } from "@draftgg/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/services/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/http")>()),
  request,
}));

import { syncProfilePool } from "@/services/pool-sync";

const ID = "11111111-1111-4111-8111-111111111111";
const entry = {
  championId: "Ahri",
  position: "mid",
  source: "opgg",
  games: 30,
  winRate: 0.55,
  excluded: false,
};
const profile: Profile = {
  id: ID,
  displayName: "たろう",
  riotId: "Faker#KR1",
  region: "KR",
  roles: ["mid"],
  syncedAt: null,
  pool: [],
};

function respondWith(body: unknown) {
  request.mockResolvedValueOnce({ json: async () => body });
}

beforeEach(() => {
  invoke.mockReset();
  request.mockReset();
});

describe("syncProfilePool", () => {
  it("api からプールを取り、ローカルのプレイヤーへ反映して返す", async () => {
    respondWith({ entries: [entry] });
    const synced = { ...profile, syncedAt: "2026-11-13T00:00:00.000Z", pool: [entry] };
    invoke.mockResolvedValueOnce(synced);

    expect(await syncProfilePool(profile)).toEqual(synced);

    expect(request).toHaveBeenCalledTimes(1);
    const [path, init] = request.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/pool-sync");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      riotId: "Faker#KR1",
      region: "KR",
      roles: ["mid"],
    });
    expect(invoke).toHaveBeenCalledWith("apply_pool_sync", { id: ID, entries: [entry] });
  });

  it("Riot ID かリージョンが無ければ、通信せずに riot_id_required", async () => {
    await expect(syncProfilePool({ ...profile, riotId: null })).rejects.toThrow("riot_id_required");
    await expect(syncProfilePool({ ...profile, region: null })).rejects.toThrow("riot_id_required");
    expect(request).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("api が失敗したら、ローカルは変えずにそのコードで失敗する", async () => {
    const { ApiError } = await import("@/services/http");
    request.mockRejectedValueOnce(new ApiError(429, "sync_too_soon", 60));

    await expect(syncProfilePool(profile)).rejects.toThrow("sync_too_soon");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("応答の形が違えば、ローカルは変えずに sync_failed", async () => {
    respondWith({ entries: [{ championId: "Ahri" }] });

    await expect(syncProfilePool(profile)).rejects.toThrow("sync_failed");
    expect(invoke).not.toHaveBeenCalled();
  });
});
