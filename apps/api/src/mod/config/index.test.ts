import { describe, expect, it } from "vitest";

import { loadConfig } from "./index.js";

const DATABASE_URL = "mysql://user:password@127.0.0.1:3306/draftgg_test";
const baseEnv = { DATABASE_URL };

describe("loadConfig", () => {
  it("未設定なら 127.0.0.1:3001 になる", () => {
    expect(loadConfig(baseEnv)).toEqual({
      host: "127.0.0.1",
      port: 3001,
      databaseUrl: DATABASE_URL,
      auth: null,
    });
  });

  it("DATABASE_URL が無ければエラーにする", () => {
    expect(() => loadConfig({})).toThrow("DATABASE_URL");
  });

  it("空文字の API_HOST は未設定として扱う", () => {
    expect(loadConfig({ ...baseEnv, API_HOST: "" }).host).toBe("127.0.0.1");
  });

  it("ループバック(IPv4 / IPv6)は指定できる", () => {
    expect(loadConfig({ ...baseEnv, API_HOST: "127.0.0.1" }).host).toBe("127.0.0.1");
    expect(loadConfig({ ...baseEnv, API_HOST: "::1" }).host).toBe("::1");
  });

  it.each(["0.0.0.0", "::", "192.168.1.10", "localhost"])(
    "ループバック以外の API_HOST(%s)はエラーにする",
    (host) => {
      expect(() => loadConfig({ ...baseEnv, API_HOST: host })).toThrow("API_HOST");
    },
  );

  it("API_PORT を数値で読み込む", () => {
    expect(loadConfig({ ...baseEnv, API_PORT: "4000" }).port).toBe(4000);
  });

  it.each(["abc", "0", "70000", "3000.5"])("不正な API_PORT(%s)はエラーにする", (port) => {
    expect(() => loadConfig({ ...baseEnv, API_PORT: port })).toThrow("API_PORT");
  });
});

describe("loadConfig のログイン設定", () => {
  const authEnv = {
    ...baseEnv,
    BETTER_AUTH_URL: "https://draft.example.com/",
    BETTER_AUTH_SECRET: "x".repeat(32),
    DISCORD_CLIENT_ID: "client-id",
    DISCORD_CLIENT_SECRET: "client-secret",
  };

  it("4つとも空ならログインなしで動く", () => {
    expect(loadConfig({ ...baseEnv, BETTER_AUTH_URL: "", DISCORD_CLIENT_ID: "" }).auth).toBeNull();
  });

  it("そろっていれば有効にし、URL は origin にそろえる", () => {
    expect(loadConfig(authEnv).auth).toEqual({
      baseUrl: "https://draft.example.com",
      secret: "x".repeat(32),
      discordClientId: "client-id",
      discordClientSecret: "client-secret",
    });
  });

  it("一部だけ設定されていたら、足りないキー名を出してエラーにする", () => {
    expect(() => loadConfig({ ...baseEnv, DISCORD_CLIENT_ID: "client-id" })).toThrow(
      "BETTER_AUTH_URL, BETTER_AUTH_SECRET, DISCORD_CLIENT_SECRET",
    );
  });

  it("URL が不正、またはシークレットが短いとエラーにする", () => {
    expect(() => loadConfig({ ...authEnv, BETTER_AUTH_URL: "draft.example.com" })).toThrow(
      "BETTER_AUTH_URL",
    );
    expect(() => loadConfig({ ...authEnv, BETTER_AUTH_URL: "ftp://draft.example.com" })).toThrow(
      "BETTER_AUTH_URL",
    );
    expect(() => loadConfig({ ...authEnv, BETTER_AUTH_SECRET: "short" })).toThrow(
      "BETTER_AUTH_SECRET",
    );
  });
});
