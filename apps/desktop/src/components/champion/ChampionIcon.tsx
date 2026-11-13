import type { Champion } from "@draftgg/shared";

import { championImageUrl } from "@/services/champions";

/** 親要素(relative)いっぱいに広げて表示する */
export function ChampionIcon({ champion }: { champion: Pick<Champion, "id" | "imageVersion"> }) {
  return (
    <img
      src={championImageUrl(champion)}
      alt=""
      loading="lazy"
      className="absolute inset-0 size-full object-cover"
    />
  );
}
