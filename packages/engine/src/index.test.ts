import { describe, expect, it } from "vitest";

import * as engine from "./index.js";

describe("@draftgg/engine", () => {
  it("モジュールを読み込める(テスト基盤の動作確認)", () => {
    expect(engine).toBeDefined();
  });
});
