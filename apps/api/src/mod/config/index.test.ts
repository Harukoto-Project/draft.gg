import { describe, expect, it } from "vitest";

import { loadConfig } from "./index.js";

describe("loadConfig", () => {
  it("未設定なら 127.0.0.1:3001 になる", () => {
    expect(loadConfig({})).toEqual({ host: "127.0.0.1", port: 3001 });
  });

  it("空文字の API_HOST は未設定として扱う", () => {
    expect(loadConfig({ API_HOST: "" }).host).toBe("127.0.0.1");
  });

  it("ループバック(IPv4 / IPv6)は指定できる", () => {
    expect(loadConfig({ API_HOST: "127.0.0.1" }).host).toBe("127.0.0.1");
    expect(loadConfig({ API_HOST: "::1" }).host).toBe("::1");
  });

  it.each(["0.0.0.0", "::", "192.168.1.10", "localhost"])(
    "ループバック以外の API_HOST(%s)はエラーにする",
    (host) => {
      expect(() => loadConfig({ API_HOST: host })).toThrow("API_HOST");
    },
  );

  it("API_PORT を数値で読み込む", () => {
    expect(loadConfig({ API_PORT: "4000" }).port).toBe(4000);
  });

  it.each(["abc", "0", "70000", "3000.5"])("不正な API_PORT(%s)はエラーにする", (port) => {
    expect(() => loadConfig({ API_PORT: port })).toThrow("API_PORT");
  });
});
