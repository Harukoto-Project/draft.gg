import type { DdragonClient } from "@draftgg/data-sources";
import { describe, expect, it, vi } from "vitest";

import { createDdragonJob } from "./ddragon.js";

const ahri = {
  id: "Ahri",
  numericKey: 103,
  nameJa: "アーリ",
  nameEn: "Ahri",
  tags: ["Mage"],
  imageVersion: "16.22.1",
};

describe("createDdragonJob", () => {
  it("最新バージョンのチャンピオン一覧をパッチ番号つきで保存する", async () => {
    const client: DdragonClient = {
      fetchLatestVersion: async () => "16.22.1",
      fetchChampions: vi.fn(async () => [ahri]),
    };
    const save = vi.fn(async () => {});

    const summary = await createDdragonJob({ client, save }).run();

    expect(client.fetchChampions).toHaveBeenCalledWith("16.22.1");
    expect(save).toHaveBeenCalledWith({ patch: "16.22", champions: [ahri] });
    expect(summary).toEqual({ version: "16.22.1", patch: "16.22", champions: 1 });
  });

  it("取得に失敗したら保存せずエラーにする", async () => {
    const client: DdragonClient = {
      fetchLatestVersion: async () => "16.22.1",
      fetchChampions: async () => {
        throw new Error("HTTP 503");
      },
    };
    const save = vi.fn(async () => {});

    await expect(createDdragonJob({ client, save }).run()).rejects.toThrow("HTTP 503");
    expect(save).not.toHaveBeenCalled();
  });
});
