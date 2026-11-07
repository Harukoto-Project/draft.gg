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

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LeaguepediaClientOptions {
  credentials: LeaguepediaCredentials;
  fetch?: FetchLike;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/**
 * bot でログインし、ScoreboardGames と PicksAndBansS7 からピックと BAN の名前を取る。
 * 順番は、青サイドが先攻という前提で大会形式に割り当てる。Oracle's Elixir が
 * firstPick を持っている試合では、空いている順番だけを後から埋める。
 */
export function createLeaguepediaClient(options: LeaguepediaClientOptions) {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? abortableSleep;
  const jar = new Map<string, string>();

  async function call(params: URLSearchParams, signal?: AbortSignal): Promise<unknown> {
    const response = await doFetch(`${API}?${params}`, {
      signal,
      headers: cookieHeader(jar),
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
      signal,
      headers: { "content-type": "application/x-www-form-urlencoded", ...cookieHeader(jar) },
      body: params,
    });
    storeCookies(jar, response);
    if (!response.ok)
      throw new Error(`Leaguepedia のログインに失敗しました (HTTP ${response.status})`);
    return response.json();
  }

  return {
    async fetchDrafts(since: string, signal?: AbortSignal): Promise<LeaguepediaDraft[]> {
      if (!/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(since)) {
        throw new Error("Leaguepedia の取得開始日が不正です");
      }
      await login(call, post, options.credentials, signal);
      const drafts: LeaguepediaDraft[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        if (signal?.aborted) throw new Error("中断されました");
        if (page > 0)
          await sleep(PAGE_INTERVAL_MS, signal ?? AbortSignal.timeout(PAGE_INTERVAL_MS));
        const params = cargoParams(since, page * PAGE_SIZE);
        const body = await call(params, signal);
        const pageDrafts = readDrafts(body);
        drafts.push(...pageDrafts);
        if (pageDrafts.length < PAGE_SIZE) break;
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

function cargoParams(since: string, offset: number): URLSearchParams {
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
    where: `ScoreboardGames.DateTime_UTC >= "${since}"`,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
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
