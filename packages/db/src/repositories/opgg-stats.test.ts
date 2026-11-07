import { POSITIONS } from "@draftgg/shared";
import type { MetaStat } from "@draftgg/shared";
import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabase } from "../client.js";
import {
  MIN_ANALYSES_REQUIRING_PAIRS,
  MIN_META_ROWS_PER_POSITION,
  MIN_STATS_ROWS,
  buildChampionRateUpsert,
  buildMetaRoleUpsert,
  loadProStatsForSnapshot,
  pickStatsPatch,
  saveChampionStats,
  saveLaneMeta,
} from "./opgg-stats.js";

const connection = createDatabase("mysql://user:password@127.0.0.1:3306/draftgg_test");

afterAll(async () => {
  await connection.close();
});

const fetchedAt = new Date("2026-11-07T00:00:00.000Z");

function metaRow(position: MetaStat["position"], index: number): MetaStat {
  return {
    championId: `${position}${index}`,
    position,
    games: 1000,
    winRate: 0.51,
    pickRate: 0.05,
    banRate: 0.03,
    roleRate: 0.8,
    tierRank: 2,
  };
}

describe("buildMetaRoleUpsert", () => {
  const { sql } = buildMetaRoleUpsert(connection.db, [
    { ...metaRow("mid", 0), patch: "16.22", tier: "diamond_plus", fetchedAt },
  ]).toSQL();

  it("同じキーは UPSERT にし、更新するのはロール割合と取得時刻だけにする", () => {
    const updatePart = sql.slice(sql.indexOf("on duplicate key update"));
    expect(updatePart).toContain("`role_rate` = values(`role_rate`)");
    expect(updatePart).toContain("`fetched_at` = values(`fetched_at`)");
    expect(updatePart).not.toContain("win_rate");
    expect(updatePart).not.toContain("tier_rank");
  });
});

describe("buildChampionRateUpsert", () => {
  const { sql } = buildChampionRateUpsert(connection.db, [
    { ...metaRow("mid", 0), patch: "16.22", tier: "diamond_plus", fetchedAt },
  ]).toSQL();

  it("ダイヤ以上の勝率・ピック率・BAN率・ティアを上書きし、ロール割合は残す", () => {
    const updatePart = sql.slice(sql.indexOf("on duplicate key update"));
    expect(updatePart).toContain("`win_rate` = values(`win_rate`)");
    expect(updatePart).toContain("`pick_rate` = values(`pick_rate`)");
    expect(updatePart).toContain("`ban_rate` = values(`ban_rate`)");
    expect(updatePart).toContain("`tier_rank` = values(`tier_rank`)");
    expect(updatePart).not.toContain("role_rate");
  });
});

describe("pickStatsPatch", () => {
  it("件数が足りているパッチのうち最新のものを選ぶ", () => {
    expect(
      pickStatsPatch([
        { patch: "16.21", rows: MIN_STATS_ROWS },
        { patch: "16.22", rows: MIN_STATS_ROWS + 10 },
      ]),
    ).toBe("16.22");
  });

  it("新パッチの統計がまだ空なら、直前のパッチを使う", () => {
    expect(
      pickStatsPatch([
        { patch: "16.21", rows: MIN_STATS_ROWS },
        { patch: "16.22", rows: 3 },
      ]),
    ).toBe("16.21");
  });

  it("パッチは文字列ではなく数値として比べる", () => {
    expect(
      pickStatsPatch([
        { patch: "16.9", rows: MIN_STATS_ROWS },
        { patch: "16.10", rows: MIN_STATS_ROWS },
      ]),
    ).toBe("16.10");
  });

  it("どのパッチも足りなければ null を返す", () => {
    expect(pickStatsPatch([{ patch: "16.22", rows: 1 }])).toBeNull();
    expect(pickStatsPatch([])).toBeNull();
  });
});

describe("saveLaneMeta", () => {
  it("ロールごとの件数が最低件数未満なら保存しない", async () => {
    const rows = POSITIONS.flatMap((position) =>
      Array.from(
        {
          length: position === "mid" ? MIN_META_ROWS_PER_POSITION - 1 : MIN_META_ROWS_PER_POSITION,
        },
        (_, index) => metaRow(position, index),
      ),
    );

    await expect(saveLaneMeta(connection.db, { patch: "16.22", rows })).rejects.toThrow("mid");
  });
});

describe("saveChampionStats", () => {
  it("空の分析は保存しない", async () => {
    await expect(saveChampionStats(connection.db, { patch: "16.22", rows: [] })).rejects.toThrow(
      "保存するチャンピオンがありません",
    );
  });

  it("件数が多いのに対面もシナジーも無ければ保存しない", async () => {
    const rows = Array.from({ length: MIN_ANALYSES_REQUIRING_PAIRS }, (_, index) => ({
      ...metaRow("mid", index),
      damageType: null,
      matchups: [],
      synergies: [],
    }));

    await expect(saveChampionStats(connection.db, { patch: "16.22", rows })).rejects.toThrow(
      "対面とシナジー",
    );
  });
});

describe("loadProStatsForSnapshot", () => {
  it("失敗したときは空配列にして、メタの読み込みは失敗させない", async () => {
    const onError = vi.fn();
    const error = new Error("no table");
    await expect(
      loadProStatsForSnapshot(async () => {
        throw error;
      }, onError),
    ).resolves.toEqual([]);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("読めた統計はそのまま返す", async () => {
    const stat = {
      championId: "Ahri",
      position: "mid" as const,
      games: 20,
      picks: 4,
      bans: 1,
      presence: 0.25,
      winRate: 0.5,
      earlyPickRate: null,
    };
    await expect(
      loadProStatsForSnapshot(
        async () => [stat],
        () => {},
      ),
    ).resolves.toEqual([stat]);
  });
});
