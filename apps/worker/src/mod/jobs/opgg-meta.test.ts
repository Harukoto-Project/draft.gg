import type { OpggTransport } from "@draftgg/data-sources";
import type { ChampionRef } from "@draftgg/shared";
import { describe, expect, it, vi } from "vitest";

import { createOpggMetaJob } from "./opgg-meta.js";

const ahri: ChampionRef = {
  id: "Ahri",
  nameJa: "アーリ",
  nameEn: "Ahri",
  numericKey: 103,
  damageType: null,
};

function transport(payload: unknown): OpggTransport {
  return {
    callTool: vi.fn(async () => payload),
    close: vi.fn(async () => {}),
  };
}

const lane = (champion: string) => ({
  champion,
  play: 1000,
  win_rate: 0.5,
  pick_rate: 0.05,
  ban_rate: 0.02,
  role_rate: 0.8,
  tier: 3,
});

describe("createOpggMetaJob", () => {
  it("パッチが無いときは OP.GG を呼ばない", async () => {
    const connect = vi.fn();
    await expect(
      createOpggMetaJob({
        connect,
        listChampions: async () => [ahri],
        getCurrentPatch: async () => null,
        save: async () => {},
      }).run(),
    ).rejects.toThrow("パッチが未取り込み");
    expect(connect).not.toHaveBeenCalled();
  });

  it("取得に失敗したら保存せず、接続を閉じる", async () => {
    const client = transport({});
    const save = vi.fn();
    await expect(
      createOpggMetaJob({
        connect: async () => client,
        listChampions: async () => [ahri],
        getCurrentPatch: async () => "16.22",
        save,
      }).run(),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("メタ一覧を現在のパッチへ保存する", async () => {
    const positions = {
      top: [lane("Ahri")],
      jungle: [lane("Ahri")],
      mid: [lane("Ahri")],
      adc: [lane("Ahri")],
      support: [lane("Ahri")],
    };
    const client = transport({ data: { positions } });
    const save = vi.fn(async () => {});

    const summary = await createOpggMetaJob({
      connect: async () => client,
      listChampions: async () => [ahri],
      getCurrentPatch: async () => "16.22",
      save,
    }).run();

    expect(save).toHaveBeenCalledWith({
      patch: "16.22",
      tier: "diamond_plus",
      rows: expect.any(Array),
    });
    expect(summary).toMatchObject({ patch: "16.22", rows: 5 });
  });
});
