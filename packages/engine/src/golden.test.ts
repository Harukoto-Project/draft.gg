import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildGolden } from "./golden/scenarios.js";

/**
 * Rust 版 engine が一致を確かめる golden(入力と TS 版の出力)。
 * この TS 版の挙動が変わったのに golden が古いままだと、ここで失敗する。
 * 意図して変えたときは `UPDATE_GOLDEN=1 pnpm --filter @draftgg/engine test` で作り直す。
 */
const GOLDEN_PATH = fileURLToPath(
  new URL(
    "../../../apps/desktop/src-tauri/crates/engine/tests/golden/recommend.json",
    import.meta.url,
  ),
);

/** 1 シナリオ 1 行にして、差分を読めるようにする */
function serialize(golden: ReturnType<typeof buildGolden>): string {
  const snapshots = Object.entries(golden.snapshots)
    .map(([name, snapshot]) => `${JSON.stringify(name)}:${JSON.stringify(snapshot)}`)
    .join(",\n");
  const scenarios = golden.scenarios.map((scenario) => JSON.stringify(scenario)).join(",\n");
  return `{"snapshots":{\n${snapshots}\n},"scenarios":[\n${scenarios}\n]}\n`;
}

describe("golden(Rust 版 engine との一致用)", () => {
  it("同じシードなら、毎回同じ内容を作る", () => {
    expect(serialize(buildGolden())).toBe(serialize(buildGolden()));
  });

  it("シナリオが、ピック・BAN・プール・プロのどれも空でない出力を含む", () => {
    const { scenarios } = buildGolden();
    const has = (predicate: (scenario: (typeof scenarios)[number]) => boolean) =>
      scenarios.some(predicate);

    expect(scenarios.length).toBeGreaterThanOrEqual(150);
    expect(has((s) => s.expected.picks.some((group) => group.candidates.length > 0))).toBe(true);
    expect(has((s) => s.expected.bans.length > 0)).toBe(true);
    expect(has((s) => s.expected.picks.length === 5)).toBe(true);
    expect(has((s) => s.pools !== undefined)).toBe(true);
    expect(
      has((s) =>
        s.expected.picks.some((group) =>
          group.candidates.some((candidate) => candidate.factors.pro !== undefined),
        ),
      ),
    ).toBe(true);
    expect(
      has((s) =>
        s.expected.picks.some((group) =>
          group.candidates.some((candidate) => candidate.reasons.includes("サンプル不足")),
        ),
      ),
    ).toBe(true);
  });

  it("checked-in の golden が、いまの TS 版の出力と一致する", () => {
    const text = serialize(buildGolden());
    if (process.env["UPDATE_GOLDEN"]) {
      mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
      writeFileSync(GOLDEN_PATH, text);
    }
    expect(readFileSync(GOLDEN_PATH, "utf8")).toBe(text);
  });
});
