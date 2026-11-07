import { describe, expect, it } from "vitest";

import { championMatchesQuery } from "./champion-search.js";

const ahri = { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri" };
const fortune = { id: "MissFortune", nameJa: "ミス・フォーチュン", nameEn: "Miss Fortune" };
const ekko = { id: "Ekko", nameJa: "エコー", nameEn: "Ekko" };
const naafiri = { id: "Naafiri", nameJa: "ナフィーリ", nameEn: "Naafiri" };

describe("チャンピオン検索", () => {
  it("空の検索はすべて一致する", () => {
    expect(championMatchesQuery(ahri, "  ")).toBe(true);
  });

  it("日本語名・英語名・ID・ローマ字で絞り込める", () => {
    expect(championMatchesQuery(ahri, "アーリ")).toBe(true);
    expect(championMatchesQuery(ahri, "ahri")).toBe(true);
    expect(championMatchesQuery(ahri, "ari")).toBe(true);
    expect(championMatchesQuery(fortune, "ミス")).toBe(true);
    expect(championMatchesQuery(fortune, "misu")).toBe(true);
    expect(championMatchesQuery(fortune, "miss fortune")).toBe(true);
    expect(championMatchesQuery(fortune, "MissFortune")).toBe(true);
    expect(championMatchesQuery(ekko, "ekko")).toBe(true);
    expect(championMatchesQuery(naafiri, "nafiri")).toBe(true);
    expect(championMatchesQuery(ahri, "zed")).toBe(false);
  });
});
