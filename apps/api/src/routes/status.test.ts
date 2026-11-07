import { statusResponseSchema } from "@draftgg/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createStatusRoute } from "./status.js";
import type { StatusReader } from "./status.js";

function createApp(reader: StatusReader) {
  return new Hono().route("/status", createStatusRoute(reader));
}

describe("GET /status", () => {
  it("パッチと、ジョブごとの最終成功時刻を返す", async () => {
    const app = createApp({
      getCurrentPatch: async () => "16.22",
      listLastSuccessfulRuns: async () => [
        { job: "ddragon", finishedAt: new Date("2026-11-07T04:00:00.000Z") },
        { job: "opgg-meta", finishedAt: new Date("2026-11-07T06:00:00.000Z") },
      ],
    });

    const response = await app.request("/status");
    const body = statusResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(body).toEqual({
      patch: "16.22",
      updatedAt: {
        ddragon: "2026-11-07T04:00:00.000Z",
        "opgg-meta": "2026-11-07T06:00:00.000Z",
        "opgg-champion": null,
        "pro-aggregate": null,
      },
    });
  });

  it("未取り込みなら、すべて null", async () => {
    const app = createApp({
      getCurrentPatch: async () => null,
      listLastSuccessfulRuns: async () => [],
    });

    const body = statusResponseSchema.parse(await (await app.request("/status")).json());

    expect(body.patch).toBeNull();
    expect(Object.values(body.updatedAt).every((value) => value === null)).toBe(true);
  });

  it("表示対象のジョブだけを問い合わせる", async () => {
    let asked: readonly string[] = [];
    const app = createApp({
      getCurrentPatch: async () => null,
      listLastSuccessfulRuns: async (jobs) => {
        asked = jobs;
        return [];
      },
    });

    await app.request("/status");

    expect(asked).toEqual(["ddragon", "opgg-meta", "opgg-champion", "pro-aggregate"]);
  });
});
