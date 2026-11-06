import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "../client.js";
import { buildChampionUpsert } from "./champion-master.js";

// 接続はクエリを実行するまで張られないため、SQL の組み立てだけを検証できる
const connection = createDatabase("mysql://user:password@127.0.0.1:3306/draftgg_test");

afterAll(async () => {
  await connection.close();
});

describe("buildChampionUpsert", () => {
  const { sql, params } = buildChampionUpsert(connection.db, [
    {
      id: "Ahri",
      numericKey: 103,
      nameJa: "アーリ",
      nameEn: "Ahri",
      tags: ["Mage", "Assassin"],
      imageVersion: "16.22.1",
    },
  ]).toSQL();

  it("同じキーの行は UPSERT(ON DUPLICATE KEY UPDATE)にする", () => {
    expect(sql).toContain("on duplicate key update");
    expect(params).toContain("Ahri");
  });

  it("Data Dragon 由来の列だけを更新し、damage_type と traits は上書きしない", () => {
    const updatePart = sql.slice(sql.indexOf("on duplicate key update"));
    // 挿入しようとした値は、テーブル名で修飾しない列名で参照する
    expect(updatePart).toContain("`name_ja` = values(`name_ja`)");
    expect(updatePart).toContain("`image_version` = values(`image_version`)");
    expect(updatePart).not.toContain("damage_type");
    expect(updatePart).not.toContain("traits");
  });
});
