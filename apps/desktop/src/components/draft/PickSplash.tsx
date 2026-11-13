import type { Champion } from "@draftgg/shared";
import { useState } from "react";

import { ChampionIcon } from "@/components/champion/ChampionIcon";
import { championSplashUrl } from "@/services/champions";

/** ピック枠の背景。スプラッシュ画像を読み込めないときは、正方形のアイコンに戻す。 */
export function PickSplash({ champion }: { champion: Champion }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <ChampionIcon champion={champion} />;

  return (
    <img
      src={championSplashUrl(champion)}
      alt=""
      loading="lazy"
      className="absolute inset-0 size-full object-cover object-[50%_25%]"
      onError={() => setFailed(true)}
    />
  );
}
