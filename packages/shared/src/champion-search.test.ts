import { describe, expect, it } from "vitest";

import { championMatchesQuery } from "./champion-search.js";

const ahri = { id: "Ahri", nameJa: "アーリ", nameEn: "Ahri" };
const fortune = { id: "MissFortune", nameJa: "ミス・フォーチュン", nameEn: "Miss Fortune" };
const ekko = { id: "Ekko", nameJa: "エコー", nameEn: "Ekko" };
const naafiri = { id: "Naafiri", nameJa: "ナフィーリ", nameEn: "Naafiri" };
const kaisa = { id: "Kaisa", nameJa: "カイ＝サ", nameEn: "Kai'Sa" };
const velkoz = { id: "Velkoz", nameJa: "ヴェル＝コズ", nameEn: "Vel'Koz" };
const nunu = { id: "Nunu", nameJa: "ヌヌ＆ウィルンプ", nameEn: "Nunu & Willump" };
const jarvan = { id: "JarvanIV", nameJa: "ジャーヴァンⅣ", nameEn: "Jarvan IV" };

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

  it("記号の入った公式名を、記号なしで見つけられる", () => {
    expect(championMatchesQuery(kaisa, "カイサ")).toBe(true);
    expect(championMatchesQuery(kaisa, "カイ＝サ")).toBe(true);
    expect(championMatchesQuery(velkoz, "ヴェルコズ")).toBe(true);
    expect(championMatchesQuery(nunu, "ヌヌウィルンプ")).toBe(true);
    expect(championMatchesQuery(nunu, "nunu & willump")).toBe(true);
  });

  it("ローマ数字の名前を、算用数字で見つけられる", () => {
    expect(championMatchesQuery(jarvan, "ジャーヴァン4")).toBe(true);
    expect(championMatchesQuery(jarvan, "ジャーヴァンⅣ")).toBe(true);
    expect(championMatchesQuery(jarvan, "ジャーヴァン3")).toBe(false);
  });

  it("ひらがなでも見つけられる", () => {
    expect(championMatchesQuery(ahri, "あーり")).toBe(true);
    expect(championMatchesQuery(fortune, "みす")).toBe(true);
    expect(championMatchesQuery(ekko, "あーり")).toBe(false);
  });
});
