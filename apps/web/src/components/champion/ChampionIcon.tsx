import type { Champion } from "@draftgg/shared";
import Image from "next/image";

import { championImageUrl } from "@/services/champions";

export function ChampionIcon({ champion }: { champion: Pick<Champion, "id" | "imageVersion"> }) {
  return (
    <Image src={championImageUrl(champion)} alt="" fill sizes="48px" className="object-cover" />
  );
}
