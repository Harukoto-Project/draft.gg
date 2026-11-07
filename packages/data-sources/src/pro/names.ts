import type { Position, ProLeague } from "@draftgg/shared";

const LEAGUE_ALIASES: Record<string, ProLeague> = {
  lck: "LCK",
  lpl: "LPL",
  lec: "LEC",
  lcs: "LTA",
  lta: "LTA",
  "lta north": "LTA",
  "lta south": "LTA",
  ltan: "LTA",
  ltas: "LTA",
  msi: "MSI",
  worlds: "Worlds",
  wlds: "Worlds",
  fst: "FirstStand",
  fs: "FirstStand",
  "first stand": "FirstStand",
};

/** Oracle's Elixir のリーグ名を、対象リーグへ寄せる。対象外は null */
export function normalizeProLeague(value: string): ProLeague | null {
  const key = value.trim().toLowerCase().replace(/\s+/g, " ");
  return LEAGUE_ALIASES[key] ?? null;
}

/** 突き合わせ用。表記ゆれ(Gen.G と Gen.G Esports)を同じキーにする */
export function normalizeTeamName(name: string): string {
  const compact = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  const stripped = compact.replace(/(esports|gaming|team)$/g, "");
  return stripped || compact;
}

export function proMatchKey(date: string, blue: string, red: string, gameNumber: string): string {
  return `${date}|${normalizeTeamName(blue)}|${normalizeTeamName(red)}|${gameNumber}`;
}

export function normalizeChampionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface ChampionName {
  id: string;
  nameEn: string;
}

/**
 * 英語名と Data Dragon のキーで引く。
 * "Nunu" のように短い通称は、一意に前方一致するときだけ長い英語名へ寄せる。
 */
export function createChampionResolver(champions: ChampionName[]): (name: string) => string | null {
  const exact = new Map<string, string>();
  const byName: { norm: string; id: string }[] = [];
  for (const champion of champions) {
    byName.push({ norm: normalizeChampionName(champion.nameEn), id: champion.id });
    for (const value of [champion.nameEn, champion.id]) {
      const norm = normalizeChampionName(value);
      if (!exact.has(norm)) exact.set(norm, champion.id);
    }
  }

  return (name) => {
    const norm = normalizeChampionName(name);
    if (!norm) return null;
    const direct = exact.get(norm);
    if (direct) return direct;
    if (norm.length < 4) return null;
    const ids = new Set(byName.filter((item) => item.norm.startsWith(norm)).map((item) => item.id));
    if (ids.size !== 1) return null;
    return [...ids][0] ?? null;
  };
}

const POSITION_ALIASES: Record<string, Position> = {
  top: "top",
  jungle: "jungle",
  jng: "jungle",
  mid: "mid",
  middle: "mid",
  adc: "adc",
  bot: "adc",
  bottom: "adc",
  support: "support",
  sup: "support",
};

export function normalizePosition(value: string): Position | null {
  return POSITION_ALIASES[value.trim().toLowerCase()] ?? null;
}
