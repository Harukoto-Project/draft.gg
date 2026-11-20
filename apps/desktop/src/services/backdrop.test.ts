import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ isTauri: true }));
const invoke = vi.hoisted(() => vi.fn());
const windowApi = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("@/lib/platform", () => platform);
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => windowApi }));

import { loadBackdrop, setWindowTheme } from "@/services/backdrop";

beforeEach(() => {
  invoke.mockReset();
  windowApi.setTheme.mockReset();
  platform.isTauri = true;
});

describe("loadBackdrop", () => {
  it("window_backdrop が mica を返したら mica", async () => {
    invoke.mockResolvedValue("mica");

    await expect(loadBackdrop()).resolves.toBe("mica");
    expect(invoke).toHaveBeenCalledWith("window_backdrop");
  });

  it("mica 以外の値は none として扱う", async () => {
    invoke.mockResolvedValue("acrylic");

    await expect(loadBackdrop()).resolves.toBe("none");
  });

  it("コマンドが失敗しても none で起動を続ける", async () => {
    invoke.mockRejectedValue(new Error("unavailable"));

    await expect(loadBackdrop()).resolves.toBe("none");
  });

  it("ブラウザ(Tauri 外)ではコマンドを呼ばず none", async () => {
    platform.isTauri = false;

    await expect(loadBackdrop()).resolves.toBe("none");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("setWindowTheme", () => {
  it("light と dark はそのままウィンドウに渡す", async () => {
    await setWindowTheme("dark");
    await setWindowTheme("light");

    expect(windowApi.setTheme).toHaveBeenNthCalledWith(1, "dark");
    expect(windowApi.setTheme).toHaveBeenNthCalledWith(2, "light");
  });

  it("system は null(OS に従う)にする", async () => {
    await setWindowTheme("system");

    expect(windowApi.setTheme).toHaveBeenCalledWith(null);
  });

  it("未知の値は OS に従う", async () => {
    await setWindowTheme(undefined);

    expect(windowApi.setTheme).toHaveBeenCalledWith(null);
  });

  it("ブラウザでは何もしない", async () => {
    platform.isTauri = false;

    await setWindowTheme("dark");

    expect(windowApi.setTheme).not.toHaveBeenCalled();
  });
});
