import type { StatsSnapshot } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createSnapshotRoute } from "./snapshot.js";

function snapshotWith(patch: string | null): StatsSnapshot {
  return {
    patch,
    tier: "diamond_plus",
    champions: [
      { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri", numericKey: 103, damageType: "ap" },
    ],
    meta: [
      {
        championId: "Ahri",
        position: "mid",
        games: 1000,
        winRate: 0.51,
        pickRate: 0.1,
        banRate: 0.03,
        roleRate: 0.9,
        tierRank: 1,
      },
    ],
    matchups: [],
    synergies: [],
    pro: [],
  };
}

function appFor(getSnapshot: () => StatsSnapshot) {
  return new Hono().route("/snapshot", createSnapshotRoute({ getSnapshot }));
}

describe("GET /snapshot", () => {
  it("統計スナップショットを、ETag とキャッシュ指定つきで返す", async () => {
    const snapshot = snapshotWith("16.22");
    const response = await appFor(() => snapshot).request("/snapshot");

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(await response.json()).toEqual(snapshot);
  });

  it("If-None-Match が ETag と一致すれば、本文なしの 304 を返す", async () => {
    const app = appFor(() => snapshotWith("16.22"));
    const first = await app.request("/snapshot");
    const etag = first.headers.get("ETag") ?? "";

    const second = await app.request("/snapshot", { headers: { "If-None-Match": etag } });

    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
    expect(await second.text()).toBe("");
  });

  it("If-None-Match が一致しなければ、通常どおり 200 を返す", async () => {
    const response = await appFor(() => snapshotWith("16.22")).request("/snapshot", {
      headers: { "If-None-Match": '"stale"' },
    });

    expect(response.status).toBe(200);
  });

  it("If-None-Match に複数の値や弱い ETag が並んでいても照合できる", async () => {
    const app = appFor(() => snapshotWith("16.22"));
    const etag = (await app.request("/snapshot")).headers.get("ETag") ?? "";

    const response = await app.request("/snapshot", {
      headers: { "If-None-Match": `"other", W/${etag}` },
    });

    expect(response.status).toBe(304);
  });

  it("中身が変わると ETag も変わる", async () => {
    let patch = "16.22";
    const app = appFor(() => snapshotWith(patch));
    const before = (await app.request("/snapshot")).headers.get("ETag");

    patch = "16.23";
    const after = (await app.request("/snapshot")).headers.get("ETag");

    expect(after).not.toBe(before);
  });

  it("同じ中身なら、別のオブジェクトでも ETag は同じ", async () => {
    // 呼ぶたびに新しいオブジェクトを返す(Workers で読み直されたときと同じ)
    const app = appFor(() => snapshotWith("16.22"));

    const first = (await app.request("/snapshot")).headers.get("ETag");
    const second = (await app.request("/snapshot")).headers.get("ETag");

    expect(second).toBe(first);
  });

  it("統計がまだ無い(パッチ未確定)間は 503 を返し、アプリが空のデータを保存しないようにする", async () => {
    const response = await appFor(() => snapshotWith(null)).request("/snapshot");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "snapshot_unavailable" });
  });

  it("Accept-Encoding: gzip のときは圧縮して返す", async () => {
    const snapshot = snapshotWith("16.22");
    const response = await appFor(() => snapshot).request("/snapshot", {
      headers: { "Accept-Encoding": "gzip" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Vary")).toContain("Accept-Encoding");
    // 圧縮しても、アプリが読む中身は同じ
    const text = await new Response(
      response.body?.pipeThrough(new DecompressionStream("gzip")),
    ).text();
    expect(JSON.parse(text)).toEqual(snapshot);
  });
});
