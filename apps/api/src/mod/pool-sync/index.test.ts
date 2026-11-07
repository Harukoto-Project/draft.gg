import type { OpggClient } from "@draftgg/data-sources";
import type { MetaStat, StatsSnapshot } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { PoolSyncError, createPoolSync } from "./index.js";

function meta(championId: string, position: MetaStat["position"], roleRate: number): MetaStat {
  return {
    championId,
    position,
    games: 1000,
    winRate: 0.5,
    pickRate: 0.05,
    banRate: 0.02,
    roleRate,
    tierRank: 2,
  };
}

const SNAPSHOT: StatsSnapshot = {
  patch: "16.22",
  tier: "diamond_plus",
  champions: [
    { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: "ap" },
    { id: "Sylas", nameJa: "サイラス", nameEn: "Sylas", numericKey: 517, damageType: "ap" },
  ],
  meta: [meta("Ahri", "mid", 0.95), meta("Sylas", "mid", 0.7), meta("Sylas", "jungle", 0.25)],
  matchups: [],
  synergies: [],
  pro: [],
};

function clientOf(pool: Awaited<ReturnType<OpggClient["getSummonerPool"]>>) {
  return {
    listLaneMeta: vi.fn(),
    analyzeChampion: vi.fn(),
    getSummonerPool: vi.fn(async () => pool),
    close: vi.fn(async () => undefined),
  } satisfies OpggClient;
}

const INPUT = { riotId: "Faker#KR1", region: "KR", roles: [] } as const;

describe("createPoolSync", () => {
  it("使用履歴のチャンピオンを、メタの主要ロールに置いて返す", async () => {
    const client = clientOf([
      { numericKey: 517, games: 40, winRate: 0.6 },
      { numericKey: 103, games: 20, winRate: 0.5 },
      { numericKey: 9999, games: 10, winRate: 0.5 },
    ]);
    const sync = createPoolSync({ getSnapshot: () => SNAPSHOT, connect: async () => client });

    const entries = await sync.fetch({ ...INPUT, roles: [...INPUT.roles] });

    expect(entries).toEqual([
      {
        championId: "Sylas",
        position: "mid",
        source: "opgg",
        games: 40,
        winRate: 0.6,
        excluded: false,
      },
      {
        championId: "Ahri",
        position: "mid",
        source: "opgg",
        games: 20,
        winRate: 0.5,
        excluded: false,
      },
    ]);
    expect(client.getSummonerPool).toHaveBeenCalledWith({
      gameName: "Faker",
      tagLine: "KR1",
      region: "KR",
    });
    expect(client.close).toHaveBeenCalled();
  });

  it("プレイヤーのロールに合わせてロールを選ぶ", async () => {
    const client = clientOf([{ numericKey: 517, games: 40, winRate: 0.6 }]);
    const sync = createPoolSync({ getSnapshot: () => SNAPSHOT, connect: async () => client });

    const entries = await sync.fetch({ ...INPUT, roles: ["jungle"] });

    expect(entries[0]?.position).toBe("jungle");
  });

  it("Riot ID の形が違えば OP.GG を呼ばずに invalid_riot_id", async () => {
    const connect = vi.fn();
    const sync = createPoolSync({ getSnapshot: () => SNAPSHOT, connect });

    await expect(sync.fetch({ ...INPUT, riotId: "no-tag", roles: [] })).rejects.toMatchObject({
      code: "invalid_riot_id",
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it("統計が未取得(チャンピオン一覧が空)なら unavailable", async () => {
    const sync = createPoolSync({
      getSnapshot: () => ({ ...SNAPSHOT, champions: [] }),
      connect: async () => clientOf([]),
    });
    await expect(sync.fetch({ ...INPUT, roles: [] })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("OP.GG の失敗は unavailable にまとめ、接続は閉じる", async () => {
    const client = clientOf([]);
    client.getSummonerPool.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sync = createPoolSync({ getSnapshot: () => SNAPSHOT, connect: async () => client });

    const error = await sync.fetch({ ...INPUT, roles: [] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PoolSyncError);
    expect(error).toMatchObject({ code: "unavailable" });
    expect(client.close).toHaveBeenCalled();
  });

  it("同時実行の上限(2)を超えたら busy", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = clientOf([]);
    client.getSummonerPool.mockImplementation(async () => {
      await gate;
      return [];
    });
    const sync = createPoolSync({ getSnapshot: () => SNAPSHOT, connect: async () => client });

    const first = sync.fetch({ ...INPUT, roles: [] });
    const second = sync.fetch({ ...INPUT, roles: [] });
    await expect(sync.fetch({ ...INPUT, roles: [] })).rejects.toMatchObject({ code: "busy" });

    release();
    await Promise.all([first, second]);
    await expect(sync.fetch({ ...INPUT, roles: [] })).resolves.toEqual([]);
  });

  it("全体の上限(1分に10回)を超えたら busy。1分たてば再び通る", async () => {
    let at = 1_000_000;
    const sync = createPoolSync({
      getSnapshot: () => SNAPSHOT,
      connect: async () => clientOf([]),
      now: () => at,
    });

    for (let i = 0; i < 10; i += 1) await sync.fetch({ ...INPUT, roles: [] });
    await expect(sync.fetch({ ...INPUT, roles: [] })).rejects.toMatchObject({ code: "busy" });

    at += 60_000;
    await expect(sync.fetch({ ...INPUT, roles: [] })).resolves.toEqual([]);
  });
});
