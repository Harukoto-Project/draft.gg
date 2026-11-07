import { championsResponseSchema } from "@draftgg/shared";
import type { Champion, ChampionsResponse } from "@draftgg/shared";

export async function loadChampions(): Promise<ChampionsResponse> {
  const response = await fetch("/api/champions");
  if (!response.ok) {
    throw new Error("champions_unavailable");
  }

  const body: unknown = await response.json();
  return championsResponseSchema.parse(body);
}

/** ピック枠に使う横長のスプラッシュ画像(バージョンに依存しない) */
export function championSplashUrl(champion: Pick<Champion, "id">): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champion.id}_0.jpg`;
}

export function championImageUrl(champion: Pick<Champion, "id" | "imageVersion">): string {
  return `https://ddragon.leagueoflegends.com/cdn/${champion.imageVersion}/img/champion/${champion.id}.png`;
}
