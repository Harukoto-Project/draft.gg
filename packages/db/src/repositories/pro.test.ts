import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "../client.js";
import { buildProGameUpsert } from "./pro.js";

const connection = createDatabase("mysql://user:password@127.0.0.1:3306/draftgg_test");

afterAll(async () => {
  await connection.close();
});

describe("buildProGameUpsert", () => {
  const { sql } = buildProGameUpsert(connection.db, [
    {
      gameKey: "oe:1",
      league: "LCK",
      event: "Spring",
      playedAt: new Date("2026-03-01T12:00:00Z"),
      gameNumber: "1",
      patch: "16.1",
      blueTeam: "T1",
      redTeam: "Gen.G",
      winnerSide: "blue",
      actions: [],
    },
  ]).toSQL();

  it("同じ game_key は UPSERT にし、出典も含めて上書きする", () => {
    const updatePart = sql.slice(sql.indexOf("on duplicate key update"));
    expect(updatePart).toContain("`league` = values(`league`)");
    expect(updatePart).toContain("`sources` = values(`sources`)");
    expect(updatePart).toContain("`game_number` = values(`game_number`)");
  });
});
