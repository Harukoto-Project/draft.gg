import { championsResponseSchema } from "@draftgg/shared";
import type { Champion, ChampionsResponse } from "@draftgg/shared";

import { apiFetch } from "@/services/http";

export async function loadChampions(): Promise<ChampionsResponse> {
  const response = await apiFetch("/api/champions");
  if (!response.ok) {
    throw new Error("champions_unavailable");
  }

  const body: unknown = await response.json();
  return championsResponseSchema.parse(body);
}

/** `centered` の画像名が、チャンピオンIDと綴りの違うもの */
const SPLASH_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  Fiddlesticks: "FiddleSticks",
};

/** ピック枠に使う横長のスプラッシュ画像(バージョンに依存しない) */
export function championSplashUrl(champion: Pick<Champion, "id">): string {
  const name = SPLASH_NAME_OVERRIDES[champion.id] ?? champion.id;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${name}_0.jpg`;
}

export function championImageUrl(champion: Pick<Champion, "id" | "imageVersion">): string {
  return `https://ddragon.leagueoflegends.com/cdn/${champion.imageVersion}/img/champion/${champion.id}.png`;
}
