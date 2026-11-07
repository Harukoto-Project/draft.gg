import { DEFAULT_RANK_TIER, POSITIONS } from "@draftgg/shared";
import type {
  ChampionRef,
  DamageType,
  MatchupStat,
  MetaStat,
  Position,
  RankTier,
  StatsSnapshot,
  SynergyStat,
} from "@draftgg/shared";
import { and, eq, sql } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

import type { Database } from "../client.js";
import { champions, matchups, metaStats, synergies } from "../schema/index.js";
import { getCurrentPatch } from "./champion-master.js";

/** 1ロールあたりの最低件数。不完全なメタ一覧で前回の統計を上書きしない。 */
export const MIN_META_ROWS_PER_POSITION = 20;

/**
 * 分析件数がこれ以上なのに対面もシナジーも無いときは、項目の取りこぼしとみなして保存しない。
 * テストの少量データはこの件数未満なので、空の対面でも保存できる。
 */
export const MIN_ANALYSES_REQUIRING_PAIRS = 10;

const INSERT_CHUNK = 200;

type Writer = Pick<Database, "insert">;

export interface LaneMetaSaveInput {
  patch: string;
  tier?: RankTier;
  rows: MetaStat[];
  fetchedAt?: Date;
}

export interface ChampionStatRow {
  championId: string;
  position: Position;
  games: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  roleRate: number;
  tierRank: number;
  damageType: DamageType | null;
  matchups: Array<Pick<MatchupStat, "opponentId" | "games" | "winRate">>;
  synergies: Array<Pick<SynergyStat, "allyId" | "allyPosition" | "games" | "winRate" | "score">>;
}

export interface ChampionStatsSaveInput {
  patch: string;
  tier?: RankTier;
  rows: ChampionStatRow[];
  fetchedAt?: Date;
}

export interface MajorRole {
  championId: string;
  nameEn: string;
  numericKey: number;
  position: Position;
  roleRate: number;
}

/** ON DUPLICATE KEY UPDATE で挿入しようとした値を参照する(列名は修飾しない) */
function valuesOf(column: AnyMySqlColumn) {
  return sql`values(${sql.identifier(column.name)})`;
}

function rate(value: number): string {
  return value.toFixed(4);
}

/**
 * メタ一覧の UPSERT。
 * 同じキーが既にあるときは role_rate だけを更新し、ダイヤ以上の勝率・ピック率・BAN率は残す。
 */
export function buildMetaRoleUpsert(
  db: Writer,
  rows: Array<MetaStat & { patch: string; tier: string; fetchedAt: Date }>,
) {
  return db
    .insert(metaStats)
    .values(
      rows.map((row) => ({
        patch: row.patch,
        tier: row.tier,
        position: row.position,
        championId: row.championId,
        games: row.games,
        winRate: rate(row.winRate),
        pickRate: rate(row.pickRate),
        banRate: rate(row.banRate),
        roleRate: rate(row.roleRate),
        tierRank: row.tierRank,
        fetchedAt: row.fetchedAt,
      })),
    )
    .onDuplicateKeyUpdate({
      set: {
        roleRate: valuesOf(metaStats.roleRate),
        fetchedAt: valuesOf(metaStats.fetchedAt),
      },
    });
}

/**
 * チャンピオン分析で上書きする UPSERT。
 * 勝率・ピック率・BAN率・試合数・ティアを更新し、role_rate はメタ一覧の値を残す。
 */
export function buildChampionRateUpsert(
  db: Writer,
  rows: Array<MetaStat & { patch: string; tier: string; fetchedAt: Date }>,
) {
  return db
    .insert(metaStats)
    .values(
      rows.map((row) => ({
        patch: row.patch,
        tier: row.tier,
        position: row.position,
        championId: row.championId,
        games: row.games,
        winRate: rate(row.winRate),
        pickRate: rate(row.pickRate),
        banRate: rate(row.banRate),
        roleRate: rate(row.roleRate),
        tierRank: row.tierRank,
        fetchedAt: row.fetchedAt,
      })),
    )
    .onDuplicateKeyUpdate({
      set: {
        games: valuesOf(metaStats.games),
        winRate: valuesOf(metaStats.winRate),
        pickRate: valuesOf(metaStats.pickRate),
        banRate: valuesOf(metaStats.banRate),
        tierRank: valuesOf(metaStats.tierRank),
        fetchedAt: valuesOf(metaStats.fetchedAt),
      },
    });
}

export async function saveLaneMeta(db: Database, input: LaneMetaSaveInput): Promise<void> {
  assertLaneCoverage(input.rows);
  const tier = input.tier ?? DEFAULT_RANK_TIER;
  const fetchedAt = input.fetchedAt ?? new Date();
  const rows = input.rows.map((row) => ({ ...row, patch: input.patch, tier, fetchedAt }));

  await db.transaction(async (tx) => {
    for (const chunk of chunks(rows, INSERT_CHUNK)) {
      await buildMetaRoleUpsert(tx, chunk);
    }
  });
}

export async function saveChampionStats(
  db: Database,
  input: ChampionStatsSaveInput,
): Promise<void> {
  if (input.rows.length === 0) {
    throw new Error("保存するチャンピオンがありません");
  }
  const matchupCount = input.rows.reduce((sum, row) => sum + row.matchups.length, 0);
  const synergyCount = input.rows.reduce((sum, row) => sum + row.synergies.length, 0);
  if (
    input.rows.length >= MIN_ANALYSES_REQUIRING_PAIRS &&
    matchupCount === 0 &&
    synergyCount === 0
  ) {
    throw new Error("対面とシナジーが1件もないため、保存を中止しました");
  }

  const tier = input.tier ?? DEFAULT_RANK_TIER;
  const fetchedAt = input.fetchedAt ?? new Date();
  const metaRows = input.rows.map((row) => ({
    patch: input.patch,
    tier,
    position: row.position,
    championId: row.championId,
    games: row.games,
    winRate: row.winRate,
    pickRate: row.pickRate,
    banRate: row.banRate,
    roleRate: row.roleRate,
    tierRank: row.tierRank,
    fetchedAt,
  }));
  const matchupRows = input.rows.flatMap((row) =>
    row.matchups.map((matchup) => ({
      patch: input.patch,
      tier,
      position: row.position,
      championId: row.championId,
      opponentId: matchup.opponentId,
      games: matchup.games,
      winRate: rate(matchup.winRate),
    })),
  );
  const synergyRows = input.rows.flatMap((row) =>
    row.synergies.map((synergy) => ({
      patch: input.patch,
      tier,
      championId: row.championId,
      position: row.position,
      allyId: synergy.allyId,
      allyPosition: synergy.allyPosition,
      games: synergy.games,
      winRate: rate(synergy.winRate),
      score: rate(synergy.score),
    })),
  );
  const damageTypes = new Map<string, DamageType>();
  for (const row of input.rows) {
    if (row.damageType) damageTypes.set(row.championId, row.damageType);
  }

  await db.transaction(async (tx) => {
    for (const chunk of chunks(metaRows, INSERT_CHUNK)) {
      await buildChampionRateUpsert(tx, chunk);
    }
    // 今回取り直したパッチの対面・シナジーは入れ替える。失敗したらトランザクションごと戻る。
    await tx.delete(matchups).where(and(eq(matchups.patch, input.patch), eq(matchups.tier, tier)));
    await tx
      .delete(synergies)
      .where(and(eq(synergies.patch, input.patch), eq(synergies.tier, tier)));
    for (const chunk of chunks(matchupRows, INSERT_CHUNK)) {
      await tx.insert(matchups).values(chunk);
    }
    for (const chunk of chunks(synergyRows, INSERT_CHUNK)) {
      await tx.insert(synergies).values(chunk);
    }
    for (const [championId, damageType] of damageTypes) {
      await tx.update(champions).set({ damageType }).where(eq(champions.id, championId));
    }
  });
}

export async function listMajorRoles(
  db: Database,
  tier: RankTier,
  minRoleRate: number,
): Promise<MajorRole[]> {
  const patch = await getCurrentPatch(db);
  if (!patch) return [];

  const rows = await db
    .select({
      championId: metaStats.championId,
      nameEn: champions.nameEn,
      numericKey: champions.numericKey,
      position: metaStats.position,
      roleRate: metaStats.roleRate,
    })
    .from(metaStats)
    .innerJoin(champions, eq(champions.id, metaStats.championId))
    .where(and(eq(metaStats.patch, patch), eq(metaStats.tier, tier)));

  return rows
    .map((row) => ({ ...row, roleRate: asNumber(row.roleRate) }))
    .filter((row) => row.roleRate >= minRoleRate);
}

export async function loadStatsSnapshot(db: Database, tier: RankTier): Promise<StatsSnapshot> {
  const patch = await getCurrentPatch(db);
  if (!patch) {
    return { patch: null, tier, champions: [], meta: [], matchups: [], synergies: [] };
  }

  const [championRows, metaRows, matchupRows, synergyRows] = await Promise.all([
    db.select().from(champions),
    db
      .select()
      .from(metaStats)
      .where(and(eq(metaStats.patch, patch), eq(metaStats.tier, tier))),
    db
      .select()
      .from(matchups)
      .where(and(eq(matchups.patch, patch), eq(matchups.tier, tier))),
    db
      .select()
      .from(synergies)
      .where(and(eq(synergies.patch, patch), eq(synergies.tier, tier))),
  ]);

  const championList: ChampionRef[] = championRows.map((row) => ({
    id: row.id,
    nameJa: row.nameJa,
    nameEn: row.nameEn,
    numericKey: row.numericKey,
    damageType: row.damageType,
  }));

  return {
    patch,
    tier,
    champions: championList,
    meta: metaRows.map((row) => ({
      championId: row.championId,
      position: row.position,
      games: row.games,
      winRate: asNumber(row.winRate),
      pickRate: asNumber(row.pickRate),
      banRate: asNumber(row.banRate),
      roleRate: asNumber(row.roleRate),
      tierRank: row.tierRank,
    })),
    matchups: matchupRows.map((row) => ({
      championId: row.championId,
      position: row.position,
      opponentId: row.opponentId,
      games: row.games,
      winRate: asNumber(row.winRate),
    })),
    synergies: synergyRows.map((row) => ({
      championId: row.championId,
      position: row.position,
      allyId: row.allyId,
      allyPosition: row.allyPosition,
      games: row.games,
      winRate: asNumber(row.winRate),
      score: asNumber(row.score),
    })),
  };
}

function assertLaneCoverage(rows: MetaStat[]): void {
  for (const position of POSITIONS) {
    const count = rows.filter((row) => row.position === position).length;
    if (count < MIN_META_ROWS_PER_POSITION) {
      throw new Error(
        `ロール ${position} の件数が ${count} 件で、最低件数(${MIN_META_ROWS_PER_POSITION})を下回るため、保存を中止しました`,
      );
    }
  }
}

function asNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("統計の率を数値にできません");
  return parsed;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
