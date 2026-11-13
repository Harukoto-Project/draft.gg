import { POSITIONS } from "@draftgg/shared";
import type {
  ChampionRef,
  MatchupStat,
  MetaStat,
  Position,
  ProStat,
  StatsSnapshot,
  SynergyStat,
} from "@draftgg/shared";

import { Random } from "./random.js";

/**
 * 大文字・小文字が混ざった ID を含める。同点のときの並び(localeCompare)を、
 * Rust 側が同じ順にそろえられるかを確かめるため(KSante と Kaisa、Vi と Viego など)。
 */
export const CHAMPION_IDS = [
  "Aatrox",
  "Ahri",
  "Akali",
  "Alistar",
  "Ashe",
  "Bard",
  "Belveth",
  "Caitlyn",
  "DrMundo",
  "Ekko",
  "Garen",
  "Jax",
  "JarvanIV",
  "Kaisa",
  "Kalista",
  "Kayn",
  "KogMaw",
  "KSante",
  "LeeSin",
  "Lux",
  "MissFortune",
  "MonkeyKing",
  "Nunu",
  "Ornn",
  "Rell",
  "Renata",
  "Sett",
  "Thresh",
  "Veigar",
  "Vi",
  "Viego",
  "Xayah",
  "Yasuo",
  "Yone",
  "Zed",
  "Zyra",
] as const;

const TAGS = ["Tank", "Fighter", "Mage", "Assassin", "Marksman", "Support"] as const;
const DAMAGE_TYPES = ["ad", "ap", "mixed", null] as const;
const GAMES = [30, 60, 120, 400, 5_000, 20_000] as const;
const TIERS = [1, 2, 3, 4, 5, 5, 3, 6] as const;

function rate(random: Random, low: number, high: number): number {
  return Math.round((low + random.next() * (high - low)) * 1000) / 1000;
}

function champions(random: Random, ids: readonly string[], withTags: boolean): ChampionRef[] {
  return ids.map((id, index) => {
    const tags = withTags && random.chance(0.85) ? pickTags(random) : undefined;
    return {
      id,
      nameJa: `名前${id}`,
      nameEn: id,
      numericKey: 100 + index,
      damageType: random.pick(DAMAGE_TYPES),
      ...(tags ? { tags } : {}),
    };
  });
}

function pickTags(random: Random): string[] {
  const count = random.between(0, 2);
  return random.shuffle(TAGS).slice(0, count);
}

function metaRows(random: Random, ids: readonly string[]): MetaStat[] {
  const rows: MetaStat[] = [];
  for (const championId of ids) {
    const main = random.pick(POSITIONS);
    const positions = new Set<Position>([main]);
    if (random.chance(0.4)) positions.add(random.pick(POSITIONS));
    for (const position of positions) {
      rows.push({
        championId,
        position,
        games: random.pick(GAMES),
        winRate: rate(random, 0.42, 0.6),
        pickRate: rate(random, 0.005, 0.2),
        banRate: rate(random, 0, 0.35),
        // 主要ロールの下限(0.1)の前後も含める
        roleRate: position === main ? rate(random, 0.4, 1) : rate(random, 0.05, 0.4),
        tierRank: random.pick(TIERS),
      });
    }
  }
  return rows;
}

function matchupRows(random: Random, meta: readonly MetaStat[], density: number): MatchupStat[] {
  const ids = [...new Set(meta.map((row) => row.championId))];
  const rows: MatchupStat[] = [];
  for (const row of meta) {
    if (row.roleRate < 0.1) continue;
    for (const opponentId of ids) {
      if (opponentId === row.championId || !random.chance(density)) continue;
      rows.push({
        championId: row.championId,
        position: row.position,
        opponentId,
        games: random.pick(GAMES),
        winRate: rate(random, 0.4, 0.62),
      });
    }
  }
  return rows;
}

function synergyRows(random: Random, meta: readonly MetaStat[], density: number): SynergyStat[] {
  const ids = [...new Set(meta.map((row) => row.championId))];
  const rows: SynergyStat[] = [];
  const seen = new Set<string>();
  for (const row of meta) {
    if (row.roleRate < 0.1) continue;
    for (const allyId of ids) {
      if (allyId === row.championId) continue;
      for (const allyPosition of POSITIONS) {
        if (allyPosition === row.position || !random.chance(density)) continue;
        const key = `${row.championId}:${row.position}:${allyId}:${allyPosition}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          championId: row.championId,
          position: row.position,
          allyId,
          allyPosition,
          games: random.pick(GAMES),
          winRate: rate(random, 0.4, 0.62),
          score: rate(random, 0, 1),
        });
      }
    }
  }
  return rows;
}

function proRows(random: Random, meta: readonly MetaStat[], share: number): ProStat[] {
  const games = random.between(60, 300);
  const rows: ProStat[] = [];
  const bansByChampion = new Map<string, number>();
  for (const row of meta) {
    if (!random.chance(share)) continue;
    const bans = bansByChampion.get(row.championId) ?? random.between(0, games);
    bansByChampion.set(row.championId, bans);
    const picks = random.between(0, Math.floor(games / 2));
    rows.push({
      championId: row.championId,
      position: row.position,
      games,
      picks,
      bans,
      presence: Math.min(1, Math.round(((picks + bans) / games) * 1000) / 1000),
      winRate: picks > 0 && random.chance(0.85) ? rate(random, 0.3, 0.75) : null,
      earlyPickRate: random.chance(0.5) ? rate(random, 0, 1) : null,
    });
  }
  return rows;
}

function build(random: Random, ids: readonly string[], density: number): StatsSnapshot {
  const meta = metaRows(random, ids);
  return {
    patch: "16.22",
    tier: "diamond_plus",
    champions: champions(random, ids, true),
    meta,
    matchups: matchupRows(random, meta, density),
    synergies: synergyRows(random, meta, density / 4),
    pro: proRows(random, meta, 0.6),
  };
}

/** 全チャンピオンにデータがある標準の統計 */
export function fullSnapshot(): StatsSnapshot {
  return build(new Random(1), CHAMPION_IDS, 0.45);
}

/** 一部のチャンピオンだけ、対面・シナジーが少ない統計 */
export function sparseSnapshot(): StatsSnapshot {
  const random = new Random(2);
  const snapshot = build(random, random.shuffle(CHAMPION_IDS).slice(0, 18), 0.12);
  return { ...snapshot, pro: [] };
}

/** 全員が同じ統計(同点)。並びが ID の順だけで決まることを確かめる */
export function tiedSnapshot(): StatsSnapshot {
  const random = new Random(3);
  const meta: MetaStat[] = CHAMPION_IDS.flatMap((championId) =>
    (["mid", "top"] as const).map((position) => ({
      championId,
      position,
      games: 10_000,
      winRate: 0.5,
      pickRate: 0.05,
      banRate: 0.05,
      roleRate: 0.8,
      tierRank: 3,
    })),
  );
  return {
    patch: "16.22",
    tier: "diamond_plus",
    champions: champions(random, CHAMPION_IDS, false),
    meta,
    matchups: [],
    synergies: [],
    pro: [],
  };
}

/** 属性(ダメージ種別・タグ)が無い統計 */
export function plainSnapshot(): StatsSnapshot {
  const random = new Random(4);
  const snapshot = build(random, CHAMPION_IDS.slice(0, 24), 0.3);
  return {
    ...snapshot,
    champions: snapshot.champions.map((champion) => ({
      id: champion.id,
      nameJa: champion.nameJa,
      nameEn: champion.nameEn,
      numericKey: champion.numericKey,
      damageType: null,
    })),
  };
}
