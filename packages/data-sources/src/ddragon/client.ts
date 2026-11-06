import { z } from "zod";

import type { DdragonChampion, DdragonClient } from "./types.js";

const BASE_URL = "https://ddragon.leagueoflegends.com";
const REQUEST_TIMEOUT_MS = 15_000;

const versionsSchema = z.array(z.string().min(1)).min(1);

const championListSchema = z.object({
  data: z.record(
    z.string(),
    z.object({
      id: z.string().min(1),
      key: z.string().regex(/^\d+$/),
      name: z.string().min(1),
      tags: z.array(z.string()),
    }),
  ),
});

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface DdragonClientOptions {
  /** テスト用に差し替えられる。既定はグローバルの fetch */
  fetch?: FetchLike;
  baseUrl?: string;
}

export function createDdragonClient(options: DdragonClientOptions = {}): DdragonClient {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = options.baseUrl ?? BASE_URL;

  async function getJson(path: string): Promise<unknown> {
    const url = `${baseUrl}${path}`;
    const response = await doFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Data Dragon の取得に失敗しました: ${url} (HTTP ${response.status})`);
    }
    return response.json();
  }

  async function fetchChampionList(version: string, locale: string) {
    const json = await getJson(`/cdn/${version}/data/${locale}/champion.json`);
    return championListSchema.parse(json).data;
  }

  return {
    async fetchLatestVersion() {
      const versions = versionsSchema.parse(await getJson("/api/versions.json"));
      // 先頭が最新。万一の取り違えを避けるため、先頭の要素をそのまま使う
      return versions[0] as string;
    },

    async fetchChampions(version) {
      const [ja, en] = await Promise.all([
        fetchChampionList(version, "ja_JP"),
        fetchChampionList(version, "en_US"),
      ]);

      const champions: DdragonChampion[] = Object.values(en).map((champion) => {
        const localized = ja[champion.id];
        if (!localized) {
          throw new Error(`日本語名が取得できないチャンピオンがあります: ${champion.id}`);
        }
        return {
          id: champion.id,
          numericKey: Number(champion.key),
          nameJa: localized.name,
          nameEn: champion.name,
          tags: champion.tags,
          imageVersion: version,
        };
      });

      return champions.sort((a, b) => a.numericKey - b.numericKey);
    },
  };
}
