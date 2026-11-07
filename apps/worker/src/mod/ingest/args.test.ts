import { describe, expect, it } from "vitest";

import { parseIngestArgs } from "./args.js";

describe("parseIngestArgs", () => {
  it("引数が無ければ、対象も CSV も空", () => {
    expect(parseIngestArgs([])).toEqual({ targets: [], csvPath: undefined });
  });

  it("ジョブ名と種類を対象として集める", () => {
    expect(parseIngestArgs(["pro", "ddragon"]).targets).toEqual(["pro", "ddragon"]);
  });

  it("--csv <パス> と --csv=<パス> の両方を読む", () => {
    expect(parseIngestArgs(["pro", "--csv", "a.csv"])).toEqual({
      targets: ["pro"],
      csvPath: "a.csv",
    });
    expect(parseIngestArgs(["--csv=b.csv", "pro-oracles"])).toEqual({
      targets: ["pro-oracles"],
      csvPath: "b.csv",
    });
  });

  it("パスの無い --csv はエラー", () => {
    expect(() => parseIngestArgs(["--csv"])).toThrow(/--csv/);
    expect(() => parseIngestArgs(["--csv", "--other"])).toThrow(/--csv/);
  });

  it("不明なオプションはエラー", () => {
    expect(() => parseIngestArgs(["--nope"])).toThrow(/--nope/);
  });
});
