import type { ProGameDraft } from "@draftgg/shared";

import { parseOraclesElixirCsv } from "./parse.js";
import type { OraclesParseResult } from "./parse.js";
import type { ChampionName } from "../pro/names.js";

/** oracleselixir.com/tools/downloads が案内している公開フォルダ */
export const ORACLES_ELIXIR_FOLDER_ID = "1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH";

const FOLDER_URL = `https://drive.google.com/embeddedfolderview?id=${ORACLES_ELIXIR_FOLDER_ID}`;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const LIST_TIMEOUT_MS = 30_000;

const FILE_NAME = /^(\d{4})_LoL_esports_match_data_from_OraclesElixir\.csv$/;

export interface OraclesFile {
  id: string;
  year: number;
  name: string;
}

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface OraclesClientOptions {
  fetch?: FetchLike;
  /** 設定されていれば、フォルダを見ずにこの URL の CSV を取る */
  fileUrl?: string;
}

export function selectOraclesFile(html: string): OraclesFile | null {
  let best: OraclesFile | null = null;
  for (const entry of html.split(/id="entry-/).slice(1)) {
    const id = /^([A-Za-z0-9_-]+)"/.exec(entry)?.[1];
    const title =
      /class="flip-entry-title">((\d{4})_LoL_esports_match_data_from_OraclesElixir\.csv)/.exec(
        entry,
      );
    const name = title?.[1];
    const year = Number(title?.[2]);
    if (!id || !name || !FILE_NAME.test(name)) continue;
    if (!best || year > best.year) best = { id, year, name };
  }
  return best;
}

export function createOraclesElixirClient(options: OraclesClientOptions = {}) {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

  async function downloadText(
    url: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await doFetch(url, { signal: combineSignal(signal, timeoutMs) });
    if (!response.ok) {
      throw new Error(`Oracle's Elixir の取得に失敗しました (HTTP ${response.status})`);
    }
    const text = await response.text();
    if (text.trimStart().startsWith("<")) {
      throw new Error("Oracle's Elixir の CSV ではなく HTML が返りました");
    }
    return text;
  }

  return {
    async fetchGames(champions: ChampionName[], signal?: AbortSignal): Promise<OraclesParseResult> {
      const csv = options.fileUrl
        ? await downloadText(options.fileUrl, DOWNLOAD_TIMEOUT_MS, signal)
        : await downloadLatest(doFetch, signal);
      if (signal?.aborted) throw new Error("中断されました");
      return parseOraclesElixirCsv(csv, champions);
    },
  };
}

async function downloadLatest(doFetch: FetchLike, signal?: AbortSignal): Promise<string> {
  const listing = await doFetch(FOLDER_URL, { signal: combineSignal(signal, LIST_TIMEOUT_MS) });
  if (!listing.ok) {
    throw new Error(`Oracle's Elixir のファイル一覧の取得に失敗しました (HTTP ${listing.status})`);
  }
  const file = selectOraclesFile(await listing.text());
  if (!file) throw new Error("Oracle's Elixir の当年 CSV が見つかりません");
  const url = `https://drive.google.com/uc?export=download&id=${file.id}&confirm=t`;
  const response = await doFetch(url, { signal: combineSignal(signal, DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Oracle's Elixir の取得に失敗しました (HTTP ${response.status})`);
  }
  const text = await response.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error("Oracle's Elixir の CSV ではなく HTML が返りました");
  }
  return text;
}

function combineSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

export type { ProGameDraft };
