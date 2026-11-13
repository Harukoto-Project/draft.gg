import { describe, expect, it } from "vitest";

import { storageErrorMessage } from "@/lib/storageErrors";

const messages = {
  unknown: "不明",
  invalid_request: "入力を確認",
  not_found: "見つからない",
  unknown_profile: "プレイヤーが無い",
  profile_limit: "上限",
};

describe("storageErrorMessage", () => {
  it("Rust のエラーコードを、画面の文言にする", () => {
    expect(storageErrorMessage(new Error("not_found"), messages, "profile_limit")).toBe(
      "見つからない",
    );
    expect(storageErrorMessage(new Error("unknown_profile"), messages, "profile_limit")).toBe(
      "プレイヤーが無い",
    );
  });

  it("invalid_input は invalid_request の文言にする", () => {
    expect(storageErrorMessage(new Error("invalid_input"), messages, "profile_limit")).toBe(
      "入力を確認",
    );
  });

  it("limit_reached は、機能ごとの上限の文言にする", () => {
    expect(storageErrorMessage(new Error("limit_reached"), messages, "profile_limit")).toBe("上限");
  });

  it("知らないコードや Error 以外は unknown", () => {
    expect(storageErrorMessage(new Error("storage_io_error"), messages, "profile_limit")).toBe(
      "不明",
    );
    expect(storageErrorMessage("oops", messages, "profile_limit")).toBe("不明");
  });
});
