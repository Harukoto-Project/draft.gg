import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ isTauri: true }));
const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform", () => platform);
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { refreshSnapshot } from "@/services/snapshot";

beforeEach(() => {
  invoke.mockReset();
  platform.isTauri = true;
});

describe("refreshSnapshot", () => {
  it("refresh_snapshot コマンドを呼び、結果を返す", async () => {
    invoke.mockResolvedValue({ outcome: "updated", status: { loaded: true, patch: "16.22" } });

    const report = await refreshSnapshot();

    expect(invoke).toHaveBeenCalledWith("refresh_snapshot");
    expect(report).toEqual({ outcome: "updated", status: { loaded: true, patch: "16.22" } });
  });

  it("変更なしも返せる", async () => {
    invoke.mockResolvedValue({ outcome: "notModified", status: { loaded: true, patch: "16.22" } });

    expect((await refreshSnapshot()).outcome).toBe("notModified");
  });

  it("失敗したらエラーコードを Error のメッセージにする", async () => {
    invoke.mockRejectedValue("snapshot_network_error");

    await expect(refreshSnapshot()).rejects.toThrow("snapshot_network_error");
  });

  it("ブラウザ(開発用)ではコマンドを呼ばず、何もしない", async () => {
    platform.isTauri = false;

    const report = await refreshSnapshot();

    expect(invoke).not.toHaveBeenCalled();
    expect(report).toEqual({ outcome: "notModified", status: { loaded: false, patch: null } });
  });
});
