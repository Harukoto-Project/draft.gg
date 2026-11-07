import type { OpggTransport } from "@draftgg/data-sources";
import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import {
  OPGG_CALL_ATTEMPTS,
  OPGG_CALL_INTERVAL_MS,
  createOpggChampionJob,
} from "./opgg-champion.js";
import type { MajorRoleTarget } from "./opgg-champion.js";

const ahri: ChampionRef = {
  id: "Ahri",
  nameJa: "アーリ",
  nameEn: "Ahri",
  numericKey: 103,
  damageType: null,
};
const zed: ChampionRef = {
  id: "Zed",
  nameJa: "ゼド",
  nameEn: "Zed",
  numericKey: 238,
  damageType: null,
};

const targets: MajorRoleTarget[] = [
  { championId: "Ahri", nameEn: "Ahri", numericKey: 103, position: "mid", roleRate: 0.9 },
  { championId: "Zed", nameEn: "Zed", numericKey: 238, position: "mid", roleRate: 0.7 },
];

function analysis(id: number) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          data: {
            damage_type: "AP",
            summary: {
              id,
              average_stats: { ban_rate: 0.04 },
              positions: [
                {
                  name: "MID",
                  stats: {
                    play: 1000,
                    win_rate: 0.52,
                    pick_rate: 0.1,
                    role_rate: 0.9,
                    tier_data: { tier: 2, rank: 5 },
                  },
                },
              ],
            },
            strong_counters: [
              { champion_id: id === 103 ? 238 : 103, my_win_rate: 0.55, play: 200 },
            ],
          },
        }),
      },
    ],
  };
}

describe("createOpggChampionJob", () => {
  it("主要ロールが無いときは OP.GG を呼ばない", async () => {
    const connect = vi.fn();
    await expect(
      createOpggChampionJob({
        connect,
        listChampions: async () => [ahri],
        getCurrentPatch: async () => "16.22",
        listTargets: async () => [],
        save: async () => {},
      }).run(),
    ).rejects.toThrow("主要ロールがありません");
    expect(connect).not.toHaveBeenCalled();
  });

  it("呼び出しの間を空け、失敗した呼び出しだけ短くやり直してから保存する", async () => {
    let calls = 0;
    const client: OpggTransport = {
      callTool: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("一時的なエラー");
        return analysis(calls === 2 ? 103 : 238);
      }),
      close: async () => {},
    };
    const sleep = vi.fn(async (_ms: number) => {});
    const save = vi.fn(async () => {});

    const summary = await createOpggChampionJob({
      connect: async () => client,
      listChampions: async () => [ahri, zed],
      getCurrentPatch: async () => "16.22",
      listTargets: async () => targets,
      save,
      sleep,
    }).run();

    expect(client.callTool).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([
      OPGG_CALL_INTERVAL_MS,
      OPGG_CALL_INTERVAL_MS,
    ]);
    expect(save).toHaveBeenCalledOnce();
    expect(summary).toMatchObject({ champions: 2, skipped: 0, minRoleRate: 0.1 });
  });

  describe("多数のロールを取るとき", () => {
    const many: MajorRoleTarget[] = Array.from({ length: 20 }, (_, index) => ({
      championId: `C${index}`,
      nameEn: `C${index}`,
      numericKey: 1000 + index,
      position: "mid",
      roleRate: 0.5,
    }));
    const manyCatalog: ChampionRef[] = many.map((target) => ({
      id: target.championId,
      nameJa: target.championId,
      nameEn: target.nameEn,
      numericKey: target.numericKey,
      damageType: null,
    }));

    function transportFailingFor(failing: Set<string>, onCall?: () => void): OpggTransport {
      return {
        callTool: vi.fn(async (_name: string, args: Record<string, unknown>) => {
          onCall?.();
          const key = String(args.champion);
          if (failing.has(key)) throw new Error(`HTTP 503 ${key}`);
          return analysis(1000 + Number(key.slice(1)));
        }),
        close: async () => {},
      };
    }

    function jobWith(
      transport: OpggTransport,
      save: (input: { rows: unknown[] }) => Promise<void>,
    ) {
      return createOpggChampionJob({
        connect: async () => transport,
        listChampions: async () => manyCatalog,
        getCurrentPatch: async () => "16.22",
        listTargets: async () => many,
        save,
        sleep: async () => {},
      });
    }

    it("失敗が上限以内なら、失敗した分をスキップして取れた分だけ保存する", async () => {
      const save = vi.fn(async (_input: { rows: unknown[] }) => {});
      // 20件中2件(10%)は許容する
      const summary = await jobWith(transportFailingFor(new Set(["C3", "C7"])), save).run();

      expect(save).toHaveBeenCalledOnce();
      expect(save.mock.calls[0]?.[0].rows).toHaveLength(18);
      expect(summary).toMatchObject({
        champions: 18,
        skipped: 2,
        skippedTargets: ["C3:mid", "C7:mid"],
      });
    });

    it("失敗が上限を超えたら保存せず、その時点で止める", async () => {
      const save = vi.fn(async (_input: { rows: unknown[] }) => {});
      const transport = transportFailingFor(new Set(["C1", "C2", "C3"]));

      await expect(jobWith(transport, save).run()).rejects.toThrow("上限(10%)");
      expect(save).not.toHaveBeenCalled();
      // C4 以降は呼ばない(C0 の1回 + C1〜C3 が各 OPGG_CALL_ATTEMPTS 回)
      expect(transport.callTool).toHaveBeenCalledTimes(1 + 3 * OPGG_CALL_ATTEMPTS);
    });

    it("停止要求があれば、保存せずに中断する", async () => {
      const save = vi.fn(async (_input: { rows: unknown[] }) => {});
      const controller = new AbortController();
      let calls = 0;
      const transport = transportFailingFor(new Set(), () => {
        calls += 1;
        if (calls === 5) controller.abort();
      });

      await expect(jobWith(transport, save).run(controller.signal)).rejects.toThrow("停止要求");
      expect(save).not.toHaveBeenCalled();
      expect(calls).toBe(5);
    });
  });

  it("呼び出しが最後まで失敗したら保存しない", async () => {
    const client: OpggTransport = {
      callTool: async () => {
        throw new Error("HTTP 503");
      },
      close: vi.fn(async () => {}),
    };
    const save = vi.fn();

    await expect(
      createOpggChampionJob({
        connect: async () => client,
        listChampions: async () => [ahri],
        getCurrentPatch: async () => "16.22",
        listTargets: async () => [targets[0]!],
        save,
        sleep: async () => {},
      }).run(),
    ).rejects.toThrow("HTTP 503");
    expect(save).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledOnce();
  });
});
