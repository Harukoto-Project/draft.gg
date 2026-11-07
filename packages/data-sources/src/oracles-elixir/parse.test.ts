import { describe, expect, it } from "vitest";

import { parseOraclesElixirCsv } from "./parse.js";
import type { ChampionName } from "../pro/names.js";
import { selectOraclesFile } from "./client.js";

const champions: ChampionName[] = [
  { id: "Ahri", nameEn: "Ahri" },
  { id: "LeeSin", nameEn: "Lee Sin" },
  { id: "Sion", nameEn: "Sion" },
  { id: "Jinx", nameEn: "Jinx" },
  { id: "Nunu", nameEn: "Nunu & Willump" },
  { id: "Zed", nameEn: "Zed" },
  { id: "Viego", nameEn: "Viego" },
  { id: "Ornn", nameEn: "Ornn" },
  { id: "Kaisa", nameEn: "Kai'Sa" },
  { id: "Thresh", nameEn: "Thresh" },
  { id: "Orianna", nameEn: "Orianna" },
  { id: "Sejuani", nameEn: "Sejuani" },
  { id: "Gnar", nameEn: "Gnar" },
  { id: "Aphelios", nameEn: "Aphelios" },
  { id: "Nautilus", nameEn: "Nautilus" },
  { id: "Syndra", nameEn: "Syndra" },
  { id: "MonkeyKing", nameEn: "Wukong" },
  { id: "Renata", nameEn: "Renata Glasc" },
  { id: "Jhin", nameEn: "Jhin" },
  { id: "Leona", nameEn: "Leona" },
];

const header = [
  "gameid",
  "datacompleteness",
  "league",
  "split",
  "playoffs",
  "date",
  "game",
  "patch",
  "side",
  "position",
  "teamname",
  "firstpick",
  "champion",
  "ban1",
  "ban2",
  "ban3",
  "ban4",
  "ban5",
  "pick1",
  "pick2",
  "pick3",
  "pick4",
  "pick5",
  "result",
];

const players = [
  ["Blue", "top", "Sion"],
  ["Blue", "jng", "Lee Sin"],
  ["Blue", "mid", "Ahri"],
  ["Blue", "bot", "Jinx"],
  ["Blue", "sup", "Nunu"],
  ["Red", "top", "Ornn"],
  ["Red", "jng", "Viego"],
  ["Red", "mid", "Zed"],
  ["Red", "bot", "Kai'Sa"],
  ["Red", "sup", "Thresh"],
] as const;

function cells(values: string[]): string {
  return values
    .map((value) => (value.includes(",") ? `"${value.replaceAll('"', '""')}"` : value))
    .join(",");
}

function game(input: {
  id: string;
  league: string;
  complete?: string;
  first: "blue" | "red";
  blueTeam?: string;
  patch?: string;
  bluePicks?: string[];
}): string[] {
  const bluePicks = input.bluePicks ?? ["Ahri", "Lee Sin", "Sion", "Jinx", "Nunu"];
  const redPicks = ["Zed", "Viego", "Ornn", "Kai'Sa", "Thresh"];
  const blueBans = ["Orianna", "Sejuani", "Gnar", "Aphelios", "Nautilus"];
  const redBans = ["Syndra", "Wukong", "Renata", "Jhin", "Leona"];
  const blueFirst = input.first === "blue";
  const blueTeam = input.blueTeam ?? "T1";
  const row = (
    side: string,
    position: string,
    team: string,
    firstPick: string,
    champion: string,
    bans: string[],
    picks: string[],
    result: string,
  ) =>
    cells([
      input.id,
      input.complete ?? "complete",
      input.league,
      "Spring",
      "0",
      "2026-03-01 12:00:00",
      "1",
      input.patch ?? "16.01",
      side,
      position,
      team,
      firstPick,
      champion,
      ...bans,
      ...picks,
      result,
    ]);

  return [
    row(
      "Blue",
      "team",
      blueTeam,
      blueFirst ? "1" : "0",
      "",
      blueBans,
      bluePicks,
      blueFirst ? "1" : "0",
    ),
    row(
      "Red",
      "team",
      "Gen.G Esports",
      blueFirst ? "0" : "1",
      "",
      redBans,
      redPicks,
      blueFirst ? "0" : "1",
    ),
    ...players.map(([side, position, champion]) =>
      row(
        side,
        position,
        side === "Blue" ? blueTeam : "Gen.G Esports",
        "",
        champion,
        ["", "", "", "", ""],
        ["", "", "", "", ""],
        "",
      ),
    ),
  ];
}

describe("parseOraclesElixirCsv", () => {
  const csv = [
    cells(header),
    ...game({ id: "g1", league: "LCK", first: "blue", blueTeam: "Gen.G, Esports" }),
    ...game({ id: "g2", league: "LCS", first: "red" }),
    ...game({ id: "g3", league: "LCK", first: "blue", complete: "partial" }),
    ...game({ id: "g4", league: "DCup", first: "blue" }),
    ...game({
      id: "g5",
      league: "LCK",
      first: "blue",
      bluePicks: ["Ahri", "Lee Sin", "Sion", "Jinx", "NotReal"],
    }),
  ].join("\n");

  const parsed = parseOraclesElixirCsv(csv, champions);

  it("対象リーグの完了試合だけを、チャンピオンIDと順番つきで読む", () => {
    expect(parsed.games.map((item) => item.gameKey)).toEqual(["oe:g1", "oe:g2"]);
    const first = parsed.games[0];
    expect(first?.league).toBe("LCK");
    expect(first?.patch).toBe("16.1");
    expect(first?.blueTeam).toBe("Gen.G, Esports");
    expect(first?.winnerSide).toBe("blue");
    const ahri = first?.actions.find((action) => action.championId === "Ahri");
    const lee = first?.actions.find((action) => action.championId === "LeeSin");
    const zed = first?.actions.find((action) => action.championId === "Zed");
    const wukong = first?.actions.find((action) => action.championId === "MonkeyKing");
    const nunu = first?.actions.find((action) => action.championId === "Nunu");
    const renata = first?.actions.find((action) => action.championId === "Renata");
    expect(ahri).toMatchObject({ type: "pick", order: 1, position: "mid", side: "blue" });
    expect(lee).toMatchObject({ type: "pick", order: 4, position: "jungle" });
    expect(zed).toMatchObject({ type: "pick", order: 2, side: "red" });
    expect(wukong).toMatchObject({ type: "ban", order: 4 });
    expect(nunu?.championId).toBe("Nunu");
    expect(renata).toMatchObject({ type: "ban" });
  });

  it("LCSはLTAにまとめ、赤サイド先攻では赤の第1ピックが順番1になる", () => {
    const second = parsed.games[1];
    expect(second?.league).toBe("LTA");
    expect(second?.actions.find((action) => action.championId === "Zed")?.order).toBe(1);
  });

  it("未完了と未知のチャンピオンは数えるが、対象外リーグは数えない", () => {
    expect(parsed.skipped).toEqual({ incomplete: 1, invalid: 0, unmapped: 1 });
    expect(parsed.unmappedChampions).toEqual(["NotReal"]);
  });
});

describe("selectOraclesFile", () => {
  it("公開フォルダの一覧から、いちばん新しい年のCSVを選ぶ", () => {
    const html = `
      <div id="entry-old" class="flip-entry"><div class="flip-entry-title">2025_LoL_esports_match_data_from_OraclesElixir.csv</div></div>
      <div id="entry-new" class="flip-entry"><div class="flip-entry-title">2026_LoL_esports_match_data_from_OraclesElixir.csv</div></div>
    `;
    expect(selectOraclesFile(html)).toEqual({
      id: "new",
      year: 2026,
      name: "2026_LoL_esports_match_data_from_OraclesElixir.csv",
    });
  });
});
