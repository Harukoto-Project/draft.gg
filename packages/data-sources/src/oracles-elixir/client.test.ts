import { describe, expect, it, vi } from "vitest";

import { createOraclesElixirClient } from "./client.js";

const HEADER = "gameid,league,date,game,patch,side,position,champion\n";

describe("createOraclesElixirClient(ローカルの CSV)", () => {
  it("filePath があれば、ネットワークを使わずにそのファイルを読む", async () => {
    const fetch = vi.fn();
    const readFile = vi.fn(async () => HEADER);
    const client = createOraclesElixirClient({ fetch, filePath: "/tmp/2026.csv", readFile });

    const result = await client.fetchGames([]);

    expect(readFile).toHaveBeenCalledWith("/tmp/2026.csv");
    expect(fetch).not.toHaveBeenCalled();
    expect(result.games).toEqual([]);
  });

  it("filePath は fileUrl より優先する", async () => {
    const fetch = vi.fn();
    const readFile = vi.fn(async () => HEADER);
    const client = createOraclesElixirClient({
      fetch,
      fileUrl: "https://example.com/a.csv",
      filePath: "a.csv",
      readFile,
    });

    await client.fetchGames([]);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("読めないときは、パスを含むエラーにする", async () => {
    const client = createOraclesElixirClient({
      filePath: "missing.csv",
      readFile: async () => {
        throw new Error("ENOENT");
      },
    });

    await expect(client.fetchGames([])).rejects.toThrow(/missing\.csv.*ENOENT/);
  });

  it("Drive の上限超過の HTML は、原因と --csv での回避策を示す", async () => {
    const listing = `<div id="entry-abc123"><div class="flip-entry-title">2026_LoL_esports_match_data_from_OraclesElixir.csv</div></div>`;
    const quota = "<!DOCTYPE html><title>Google Drive - Quota exceeded</title>";
    const fetch = vi.fn(
      async (url: string) => new Response(url.includes("embeddedfolderview") ? listing : quota),
    );
    const client = createOraclesElixirClient({ fetch });

    await expect(client.fetchGames([])).rejects.toThrow(/取得上限.*--csv/);
  });

  it("HTML が入っているファイルは CSV として扱わない", async () => {
    const client = createOraclesElixirClient({
      filePath: "page.csv",
      readFile: async () => "<!DOCTYPE html>",
    });

    await expect(client.fetchGames([])).rejects.toThrow(/HTML/);
  });
});
