import type { OpggTransport } from "@draftgg/data-sources";
import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { OPGG_CALL_INTERVAL_MS, createOpggChampionJob } from "./opgg-champion.js";
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
              average_stats: {
                play: 1000,
                win_rate: 0.52,
                pick_rate: 0.1,
                ban_rate: 0.04,
                tier: 2,
              },
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
    expect(summary).toMatchObject({ champions: 2, minRoleRate: 0.1 });
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
