import { describe, expect, it } from "vitest";

import { createDdragonClient } from "./client.js";
import { patchOf } from "./version.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function championList(entries: Record<string, { key: string; name: string; tags: string[] }>) {
  return {
    data: Object.fromEntries(Object.entries(entries).map(([id, value]) => [id, { id, ...value }])),
  };
}

describe("patchOf", () => {
  it("Data Dragon のバージョンからパッチ番号を取り出す", () => {
    expect(patchOf("16.21.1")).toBe("16.21");
    expect(patchOf("16.21")).toBe("16.21");
  });

  it("不正な形式はエラーにする", () => {
    expect(() => patchOf("latest")).toThrow();
  });
});

describe("createDdragonClient", () => {
  it("versions.json の先頭を最新バージョンとして返す", async () => {
    const client = createDdragonClient({
      fetch: async () => jsonResponse(["16.21.1", "16.20.1"]),
    });
    await expect(client.fetchLatestVersion()).resolves.toBe("16.21.1");
  });

  it("日本語名と英語名を結合し、数値IDの昇順で返す", async () => {
    const urls: string[] = [];
    const client = createDdragonClient({
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("/ja_JP/")) {
          return jsonResponse(
            championList({
              Ahri: { key: "103", name: "アーリ", tags: ["Mage", "Assassin"] },
              Aatrox: { key: "266", name: "エイトロックス", tags: ["Fighter"] },
            }),
          );
        }
        return jsonResponse(
          championList({
            Aatrox: { key: "266", name: "Aatrox", tags: ["Fighter"] },
            Ahri: { key: "103", name: "Ahri", tags: ["Mage", "Assassin"] },
          }),
        );
      },
    });

    const champions = await client.fetchChampions("16.21.1");

    expect(champions).toEqual([
      {
        id: "Ahri",
        numericKey: 103,
        nameJa: "アーリ",
        nameEn: "Ahri",
        tags: ["Mage", "Assassin"],
        imageVersion: "16.21.1",
      },
      {
        id: "Aatrox",
        numericKey: 266,
        nameJa: "エイトロックス",
        nameEn: "Aatrox",
        tags: ["Fighter"],
        imageVersion: "16.21.1",
      },
    ]);
    expect(urls).toContain(
      "https://ddragon.leagueoflegends.com/cdn/16.21.1/data/ja_JP/champion.json",
    );
  });

  it("日本語名が欠けているチャンピオンがあればエラーにする", async () => {
    const client = createDdragonClient({
      fetch: async (url) =>
        jsonResponse(
          url.includes("/ja_JP/")
            ? championList({})
            : championList({ Ahri: { key: "103", name: "Ahri", tags: [] } }),
        ),
    });
    await expect(client.fetchChampions("16.21.1")).rejects.toThrow("Ahri");
  });

  it("HTTP エラーはエラーにする", async () => {
    const client = createDdragonClient({ fetch: async () => jsonResponse({}, 503) });
    await expect(client.fetchLatestVersion()).rejects.toThrow("503");
  });

  it("想定外の形式のレスポンスはエラーにする", async () => {
    const client = createDdragonClient({ fetch: async () => jsonResponse({ foo: 1 }) });
    await expect(client.fetchLatestVersion()).rejects.toThrow();
  });
});
