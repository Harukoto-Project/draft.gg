import type { ProActionType, Side } from "@draftgg/shared";

import { assignDraftOrder } from "../pro/order.js";

export interface LeaguepediaCredentials {
  username: string;
  password: string;
}

export interface LeaguepediaDraft {
  matchDate: string;
  blueTeam: string;
  redTeam: string;
  gameNumber: string;
  bluePicks: string[];
  redPicks: string[];
  blueBans: string[];
  redBans: string[];
}

export interface LeaguepediaOrder {
  side: Side;
  type: ProActionType;
  order: number;
  championName: string;
}

const API = "https://lol.fandom.com/api.php";
const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const PAGE_INTERVAL_MS = 3_000;
const REQUEST_TIMEOUT_MS = 60_000;
/** 日付をまとめすぎると、1回が上限まで埋まって失敗する */
const DATE_BATCH = 15;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LeaguepediaClientOptions {
  credentials: LeaguepediaCredentials;
  fetch?: FetchLike;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** テスト用。本番は 500 */
  pageSize?: number;
  /** テスト用。本番は 40 */
  maxPages?: number;
  /** テスト用。本番は 60 秒 */
  timeoutMs?: number;
}

/**
 * bot でログインし、ScoreboardGames と PicksAndBansS7 からピックと BAN の名前を取る。
 * 順番は、青サイドが先攻という前提で大会形式に割り当てる。Oracle's Elixir が
 * firstPick を持っている試合では、空いている順番だけを後から埋める。
 */
export function createLeaguepediaClient(options: LeaguepediaClientOptions) {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? abortableSleep;
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const jar = new Map<string, string>();
  const headers = () => requestHeaders(jar, options.credentials.username);

  async function call(params: URLSearchParams, signal?: AbortSignal): Promise<unknown> {
    const response = await doFetch(`${API}?${params}`, {
      signal: requestSignal(signal, timeoutMs),
      headers: headers(),
    });
    storeCookies(jar, response);
    if (!response.ok) {
      throw new Error(`Leaguepedia の取得に失敗しました (HTTP ${response.status})`);
    }
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error)) {
      const info = typeof body.error.info === "string" ? body.error.info : "不明なエラー";
      throw new Error(`Leaguepedia の取得に失敗しました: ${info}`);
    }
    return body;
  }

  async function post(params: URLSearchParams, signal?: AbortSignal): Promise<unknown> {
    const response = await doFetch(API, {
      method: "POST",
      signal: requestSignal(signal, timeoutMs),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...headers(),
      },
      body: params,
    });
    storeCookies(jar, response);
    if (!response.ok)
      throw new Error(`Leaguepedia のログインに失敗しました (HTTP ${response.status})`);
    return response.json();
  }

  return {
    /**
     * 順番が空の試合の日付だけを、新しい順に取る。
     * ScoreboardGames にリーグ列は無く、リーグキーも別名なので、日付で絞る。
     * ページ上限まで埋まっていたら、続きを取りこぼしたまま成功にしない。
     */
    async fetchDrafts(dates: string[], signal?: AbortSignal): Promise<LeaguepediaDraft[]> {
      const days = normalizeDates(dates);
      if (days.length === 0) return [];
      await login(call, post, options.credentials, signal);
      const drafts: LeaguepediaDraft[] = [];
      let requested = false;
      for (const batch of chunks(days, DATE_BATCH)) {
        for (let page = 0; page < maxPages; page += 1) {
          if (signal?.aborted) throw new Error("中断されました");
          if (requested) {
            await sleep(PAGE_INTERVAL_MS, signal ?? AbortSignal.timeout(PAGE_INTERVAL_MS));
          }
          requested = true;
          const body = await call(cargoParams(batch, page * pageSize, pageSize), signal);
          const rowCount = cargoRowCount(body);
          drafts.push(...readDrafts(body));
          if (rowCount < pageSize) break;
          if (page === maxPages - 1) {
            throw new Error("Leaguepedia の取得件数が上限に達したため、順番の補完を中止しました");
          }
        }
      }
      return drafts;
    },
  };
}

/** 青サイド先攻として順番を付ける。Leaguepedia は先攻側を返さない */
export function leaguepediaOrders(draft: LeaguepediaDraft): LeaguepediaOrder[] {
  return assignDraftOrder({
    first: "blue",
    bluePicks: draft.bluePicks,
    redPicks: draft.redPicks,
    blueBans: draft.blueBans,
    redBans: draft.redBans,
  }).flatMap((action) =>
    action.order === null ? [] : [{ ...action, order: action.order, championName: action.name }],
  );
}

function cargoParams(dates: string[], offset: number, limit: number): URLSearchParams {
  const fields = [
    "ScoreboardGames.DateTime_UTC=playedAt",
    "ScoreboardGames.N_GameInMatch=gameNumber",
    "ScoreboardGames.Team1=blueTeam",
    "ScoreboardGames.Team2=redTeam",
    ...namedFields("Pick"),
    ...namedFields("Ban"),
  ].join(",");
  return new URLSearchParams({
    action: "cargoquery",
    format: "json",
    tables: "PicksAndBansS7,ScoreboardGames",
    join_on: "PicksAndBansS7.GameId=ScoreboardGames.GameId",
    fields,
    where: dates.map(dayClause).join(" OR "),
    order_by: "ScoreboardGames.DateTime_UTC DESC",
    limit: String(limit),
    offset: String(offset),
  });
}

function dayClause(date: string): string {
  return `(ScoreboardGames.DateTime_UTC >= "${date} 00:00:00" AND ScoreboardGames.DateTime_UTC < "${nextUtcDate(date)} 00:00:00")`;
}

function normalizeDates(dates: string[]): string[] {
  const unique = [...new Set(dates)].sort();
  for (const date of unique) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Leaguepedia の取得日が不正です");
    }
  }
  return unique;
}

function nextUtcDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error("Leaguepedia の取得日が不正です");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function cargoRowCount(body: unknown): number {
  if (!isRecord(body) || !Array.isArray(body.cargoquery)) return 0;
  return body.cargoquery.length;
}

function requestHeaders(
  jar: Map<string, string>,
  username: string,
): { "user-agent": string; cookie?: string } {
  return {
    "user-agent": `draft.gg (${username.replace(/[\r\n]/g, "")})`,
    ...cookieHeader(jar),
  };
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function namedFields(kind: "Pick" | "Ban"): string[] {
  const alias = kind === "Pick" ? "pick" : "ban";
  const fields: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    fields.push(`PicksAndBansS7.Team1${kind}${index}=blue${alias}${index}`);
    fields.push(`PicksAndBansS7.Team2${kind}${index}=red${alias}${index}`);
  }
  return fields;
}

async function login(
  call: (params: URLSearchParams, signal?: AbortSignal) => Promise<unknown>,
  post: (params: URLSearchParams, signal?: AbortSignal) => Promise<unknown>,
  credentials: LeaguepediaCredentials,
  signal?: AbortSignal,
): Promise<void> {
  const tokenBody = await call(
    new URLSearchParams({ action: "query", meta: "tokens", type: "login", format: "json" }),
    signal,
  );
  const token = readLoginToken(tokenBody);
  const params = new URLSearchParams({
    action: "login",
    format: "json",
    lgname: credentials.username,
    lgpassword: credentials.password,
    lgtoken: token,
  });
  const body = await post(params, signal);
  const result =
    isRecord(body) && isRecord(body.login) && typeof body.login.result === "string"
      ? body.login.result
      : "";
  if (result !== "Success") throw new Error("Leaguepedia のログインに失敗しました");
}

function readLoginToken(body: unknown): string {
  if (!isRecord(body) || !isRecord(body.query) || !isRecord(body.query.tokens)) {
    throw new Error("Leaguepedia のログイントークンを取得できません");
  }
  const token = body.query.tokens.logintoken;
  if (typeof token !== "string" || token === "") {
    throw new Error("Leaguepedia のログイントークンを取得できません");
  }
  return token;
}

function readDrafts(body: unknown): LeaguepediaDraft[] {
  if (!isRecord(body) || !Array.isArray(body.cargoquery)) return [];
  const drafts: LeaguepediaDraft[] = [];
  for (const entry of body.cargoquery) {
    if (!isRecord(entry) || !isRecord(entry.title)) continue;
    const title = entry.title;
    const playedAt = text(title, "playedAt");
    const matchDate = /^(\d{4}-\d{2}-\d{2})/.exec(playedAt)?.[1];
    const blueTeam = text(title, "blueTeam");
    const redTeam = text(title, "redTeam");
    const gameNumber = text(title, "gameNumber");
    if (!matchDate || !blueTeam || !redTeam || !gameNumber) continue;
    drafts.push({
      matchDate,
      blueTeam,
      redTeam,
      gameNumber,
      bluePicks: series(title, "bluepick"),
      redPicks: series(title, "redpick"),
      blueBans: series(title, "blueban"),
      redBans: series(title, "redban"),
    });
  }
  return drafts;
}

function series(title: Record<string, unknown>, prefix: string): string[] {
  const names: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = text(title, `${prefix}${index}`);
    if (name) names.push(name);
  }
  return names;
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function cookieHeader(jar: Map<string, string>): { cookie?: string } {
  if (jar.size === 0) return {};
  return { cookie: [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ") };
}

function storeCookies(jar: Map<string, string>, response: Response): void {
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
