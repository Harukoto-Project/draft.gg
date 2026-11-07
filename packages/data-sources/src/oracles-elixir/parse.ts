import type { Position, ProDraftAction, ProGameDraft, Side } from "@draftgg/shared";
import { normalizePatch } from "@draftgg/shared";

import { createChampionResolver, normalizePosition, normalizeProLeague } from "../pro/names.js";
import type { ChampionName } from "../pro/names.js";
import { assignDraftOrder } from "../pro/order.js";

export interface OraclesParseResult {
  games: ProGameDraft[];
  skipped: { incomplete: number; invalid: number; unmapped: number };
  /** チャンピオン名を解決できなかった試合で出た名前。重複は除き、先頭 20 件 */
  unmappedChampions: string[];
}

const PICKS_PER_SIDE = 5;
const BANS_PER_SIDE = 5;

/**
 * Oracle's Elixir の試合 CSV を、対象リーグの完了試合だけに分ける。
 * チーム行の pick1〜5 / ban1〜5 と firstPick から、大会形式の順番を付ける。
 */
export function parseOraclesElixirCsv(csv: string, champions: ChampionName[]): OraclesParseResult {
  const table = parseCsv(csv);
  const header = table[0];
  if (!header) throw new Error("Oracle's Elixir の CSV が空です");
  const columns = indexColumns(header);
  const resolve = createChampionResolver(champions);

  const games: ProGameDraft[] = [];
  const skipped = { incomplete: 0, invalid: 0, unmapped: 0 };
  const unmapped = new Set<string>();
  let currentId = "";
  let bucket: Map<string, string>[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const outcome = buildGame(bucket, resolve);
    if (outcome.kind === "game") games.push(outcome.game);
    else if (outcome.kind !== "ignore") skipped[outcome.kind] += 1;
    for (const name of outcome.kind === "unmapped" ? outcome.names : []) {
      if (unmapped.size < 20) unmapped.add(name);
    }
    bucket = [];
  };

  for (const cells of table.slice(1)) {
    if (cells.every((cell) => cell.trim() === "")) continue;
    const row = rowOf(columns, cells);
    const gameId = row.get("gameid") ?? "";
    if (!gameId) continue;
    if (currentId && gameId !== currentId) flush();
    currentId = gameId;
    if (normalizeProLeague(row.get("league") ?? "")) bucket.push(row);
  }
  flush();

  return { games, skipped, unmappedChampions: [...unmapped] };
}

type SkipKind = "incomplete" | "invalid" | "unmapped";

type BuildOutcome =
  | { kind: "game"; game: ProGameDraft }
  | { kind: "ignore" }
  | { kind: SkipKind; names: string[] };

function buildGame(
  rows: Map<string, string>[],
  resolve: (name: string) => string | null,
): BuildOutcome {
  const first = rows[0];
  if (!first) return { kind: "ignore" };
  const league = normalizeProLeague(first.get("league") ?? "");
  if (!league) return { kind: "ignore" };
  if ((first.get("datacompleteness") ?? "").toLowerCase() !== "complete") {
    return { kind: "incomplete", names: [] };
  }

  const teams = rows.filter((row) => (row.get("position") ?? "").toLowerCase() === "team");
  const blueTeam = teams.find((row) => sideOf(row.get("side") ?? "") === "blue");
  const redTeam = teams.find((row) => sideOf(row.get("side") ?? "") === "red");
  if (!blueTeam || !redTeam) return { kind: "invalid", names: [] };

  const bluePicks = listOf(blueTeam, "pick");
  const redPicks = listOf(redTeam, "pick");
  const blueBans = listOf(blueTeam, "ban");
  const redBans = listOf(redTeam, "ban");
  if (
    bluePicks.length !== PICKS_PER_SIDE ||
    redPicks.length !== PICKS_PER_SIDE ||
    blueBans.length !== BANS_PER_SIDE ||
    redBans.length !== BANS_PER_SIDE
  ) {
    return { kind: "invalid", names: [] };
  }

  const patch = normalizePatch(first.get("patch") ?? "");
  const playedAt = parsePlayedAt(first.get("date") ?? "");
  const gameId = first.get("gameid") ?? "";
  const gameNumber = (first.get("game") ?? "").trim();
  if (!patch || !playedAt || !gameId || !gameNumber) return { kind: "invalid", names: [] };

  const winner = winnerSide(blueTeam, redTeam);
  if (!winner) return { kind: "invalid", names: [] };

  const positions = new Map<string, Position>();
  for (const row of rows) {
    if ((row.get("position") ?? "").toLowerCase() === "team") continue;
    const side = sideOf(row.get("side") ?? "");
    const position = normalizePosition(row.get("position") ?? "");
    const champion = (row.get("champion") ?? "").trim();
    if (!side || !position || !champion) continue;
    positions.set(`${side}|${champion.toLowerCase()}`, position);
  }

  const firstSide = firstPickSide(blueTeam, redTeam);
  const named = assignDraftOrder({
    first: firstSide,
    bluePicks,
    redPicks,
    blueBans,
    redBans,
  });
  const actions: ProDraftAction[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const action of named) {
    const championId = resolve(action.name);
    if (!championId) {
      missing.push(action.name);
      continue;
    }
    if (seen.has(championId)) return { kind: "invalid", names: [] };
    seen.add(championId);
    const position =
      action.type === "pick"
        ? (positions.get(`${action.side}|${action.name.toLowerCase()}`) ?? null)
        : null;
    if (action.type === "pick" && !position) return { kind: "invalid", names: [] };
    actions.push({
      side: action.side,
      type: action.type,
      order: action.order,
      position,
      championId,
    });
  }
  if (missing.length > 0) return { kind: "unmapped", names: missing };
  if (actions.length !== PICKS_PER_SIDE * 2 + BANS_PER_SIDE * 2)
    return { kind: "invalid", names: [] };

  return {
    kind: "game",
    game: {
      gameKey: `oe:${gameId}`,
      league,
      event: eventOf(first.get("split") ?? "", first.get("playoffs") ?? ""),
      playedAt,
      gameNumber,
      patch,
      blueTeam: (blueTeam.get("teamname") ?? "").trim(),
      redTeam: (redTeam.get("teamname") ?? "").trim(),
      winnerSide: winner,
      actions,
    },
  };
}

function eventOf(split: string, playoffs: string): string {
  const name = split.trim();
  const isPlayoffs = playoffs.trim() === "1";
  const event = !name ? (isPlayoffs ? "playoffs" : "") : isPlayoffs ? `${name} playoffs` : name;
  return event.slice(0, 64);
}

function listOf(row: Map<string, string>, type: "pick" | "ban"): string[] {
  const names: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = (row.get(`${type}${index}`) ?? "").trim();
    if (name) names.push(name);
  }
  return names;
}

function firstPickSide(blue: Map<string, string>, red: Map<string, string>): Side | null {
  const blueFirst = (blue.get("firstpick") ?? "") === "1";
  const redFirst = (red.get("firstpick") ?? "") === "1";
  if (blueFirst === redFirst) return null;
  return blueFirst ? "blue" : "red";
}

function winnerSide(blue: Map<string, string>, red: Map<string, string>): Side | null {
  const blueWin = (blue.get("result") ?? "") === "1";
  const redWin = (red.get("result") ?? "") === "1";
  if (blueWin === redWin) return null;
  return blueWin ? "blue" : "red";
}

function sideOf(value: string): Side | null {
  const side = value.trim().toLowerCase();
  if (side === "blue") return "blue";
  if (side === "red") return "red";
  return null;
}

function parsePlayedAt(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function indexColumns(header: string[]): Map<string, number> {
  const columns = new Map<string, number>();
  for (const [index, name] of header.entries()) {
    columns.set(name.trim().toLowerCase(), index);
  }
  for (const name of [
    "gameid",
    "league",
    "date",
    "game",
    "patch",
    "side",
    "position",
    "champion",
  ]) {
    if (!columns.has(name)) throw new Error(`Oracle's Elixir の CSV に列がありません: ${name}`);
  }
  return columns;
}

function rowOf(columns: Map<string, number>, cells: string[]): Map<string, string> {
  const row = new Map<string, string>();
  for (const [name, index] of columns) row.set(name, cells[index] ?? "");
  return row;
}

/** 引用符とカンマを含む CSV。ファイル全体を行の配列にする */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
