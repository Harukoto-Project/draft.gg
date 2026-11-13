import type { DraftState } from "@draftgg/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ isTauri: true }));
const invoke = vi.hoisted(() => vi.fn());
const apiFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform", () => platform);
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/services/http", () => ({ apiFetch }));

import { loadRecommendations } from "@/services/recommendations";

const emptyAssignment = { top: null, jungle: null, mid: null, adc: null, support: null };
const draft: DraftState = {
  format: "ranked",
  mySide: "blue",
  actions: [],
  assignments: { blue: emptyAssignment, red: emptyAssignment },
  me: { side: "blue", position: "mid" },
};

const response = { patch: "16.22", tier: "diamond_plus", preset: "solo", picks: [], bans: [] };

beforeEach(() => {
  invoke.mockReset();
  apiFetch.mockReset();
  platform.isTauri = true;
});

describe("loadRecommendations", () => {
  it("Tauri では recommend コマンドに request を渡し、結果を検証して返す", async () => {
    invoke.mockResolvedValue(response);
    const weights = { pick: { meta: 0.5 } };

    const result = await loadRecommendations(draft, undefined, weights);

    expect(invoke).toHaveBeenCalledWith("recommend", {
      request: { draft, pools: undefined, weights },
    });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.patch).toBe("16.22");
  });

  it("コマンドが返したエラーコードをそのまま Error のメッセージにする", async () => {
    invoke.mockRejectedValue("snapshot_unavailable");

    await expect(loadRecommendations(draft)).rejects.toThrow("snapshot_unavailable");
  });

  it("コマンドの結果が想定の形でなければ失敗する", async () => {
    invoke.mockResolvedValue({ hello: 1 });

    await expect(loadRecommendations(draft)).rejects.toThrow();
  });

  it("ブラウザ(開発用)では api の /api/recommendations を呼ぶ", async () => {
    platform.isTauri = false;
    apiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });

    const result = await loadRecommendations(draft);

    expect(invoke).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/recommendations",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.preset).toBe("solo");
  });

  it("ブラウザで api が失敗したら recommendations_unavailable", async () => {
    platform.isTauri = false;
    apiFetch.mockResolvedValue({ ok: false });

    await expect(loadRecommendations(draft)).rejects.toThrow("recommendations_unavailable");
  });
});
