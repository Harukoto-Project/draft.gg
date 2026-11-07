import { describe, expect, it, vi } from "vitest";

import { createLeaguepediaClient } from "./client.js";

const credentials = { username: "DraftggBot", password: "secret" };

function json(body: unknown): Response {
  return Response.json(body);
}

describe("createLeaguepediaClient", () => {
  it("空いている試合の日付だけを、新しい順の条件で取る", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createLeaguepediaClient({
      credentials,
      sleep: async () => {},
      fetch: async (url, init) => {
        calls.push({ url, init });
        if (url.includes("type=login")) {
          return json({ query: { tokens: { logintoken: "token" } } });
        }
        if (init?.method === "POST") return json({ login: { result: "Success" } });
        return json({
          cargoquery: [
            {
              title: {
                playedAt: "2026-12-31 12:00:00",
                gameNumber: "1",
                blueTeam: "T1",
                redTeam: "Gen.G",
                bluepick1: "Ahri",
              },
            },
          ],
        });
      },
    });

    const drafts = await client.fetchDrafts(["2026-12-31", "2026-03-01", "2026-03-01"]);
    const cargo = calls.find((call) => call.url.includes("cargoquery"));
    const params = new URL(cargo?.url ?? "https://example.invalid").searchParams;

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.blueTeam).toBe("T1");
    expect(params.get("order_by")).toBe("ScoreboardGames.DateTime_UTC DESC");
    expect(params.get("where")).toContain('DateTime_UTC >= "2026-03-01 00:00:00"');
    expect(params.get("where")).toContain('DateTime_UTC < "2026-03-02 00:00:00"');
    expect(params.get("where")).toContain('DateTime_UTC >= "2026-12-31 00:00:00"');
    expect(params.get("where")).toContain('DateTime_UTC < "2027-01-01 00:00:00"');
    expect(calls[0]?.init?.headers).toMatchObject({ "user-agent": "draft.gg (DraftggBot)" });
  });

  it("上限まで満杯なら失敗する", async () => {
    const client = createLeaguepediaClient({
      credentials,
      pageSize: 1,
      maxPages: 1,
      sleep: async () => {},
      fetch: async (url, init) => {
        if (url.includes("type=login")) {
          return json({ query: { tokens: { logintoken: "token" } } });
        }
        if (init?.method === "POST") return json({ login: { result: "Success" } });
        return json({ cargoquery: [{ title: {} }] });
      },
    });

    await expect(client.fetchDrafts(["2026-03-01"])).rejects.toThrow("上限に達した");
  });

  it("日付が不正なら取得しない", async () => {
    const fetch = vi.fn();
    const client = createLeaguepediaClient({ credentials, fetch });
    await expect(client.fetchDrafts(["2026/03/01"])).rejects.toThrow("取得日が不正");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("各呼び出しはタイムアウトする", async () => {
    const client = createLeaguepediaClient({
      credentials,
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("signal missing"));
            return;
          }
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        }),
    });

    await expect(client.fetchDrafts(["2026-03-01"])).rejects.toThrow("aborted");
  });
});
