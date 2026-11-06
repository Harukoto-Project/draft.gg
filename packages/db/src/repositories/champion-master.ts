import { asc, eq, sql } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

import type { Database } from "../client.js";
import { champions, patches } from "../schema/index.js";

export type ChampionRow = typeof champions.$inferSelect;

export interface ChampionMasterInput {
  /** パッチ番号(例: "16.22") */
  patch: string;
  champions: Array<{
    id: string;
    numericKey: number;
    nameJa: string;
    nameEn: string;
    tags: string[];
    imageVersion: string;
  }>;
}

/**
 * 保存を許可する最低件数。Data Dragon の champion.json は 170 件前後なので、それを大きく下回る
 * 不完全なレスポンスでパッチだけが進み、古いマスタが混ざるのを防ぐ。
 */
export const MIN_CHAMPIONS = 150;

type Writer = Pick<Database, "insert">;

/** ON DUPLICATE KEY UPDATE で挿入しようとした値を参照する(列名は修飾しない) */
function valuesOf(column: AnyMySqlColumn) {
  return sql`values(${sql.identifier(column.name)})`;
}

/**
 * チャンピオンの UPSERT。
 * Data Dragon 由来の列だけを更新し、OP.GG 由来の damage_type や traits は上書きしない。
 */
export function buildChampionUpsert(db: Writer, rows: ChampionMasterInput["champions"]) {
  return db
    .insert(champions)
    .values(rows)
    .onDuplicateKeyUpdate({
      set: {
        numericKey: valuesOf(champions.numericKey),
        nameJa: valuesOf(champions.nameJa),
        nameEn: valuesOf(champions.nameEn),
        tags: valuesOf(champions.tags),
        imageVersion: valuesOf(champions.imageVersion),
      },
    });
}

/**
 * チャンピオンのマスタと現在のパッチを、1つのトランザクションで保存する。
 * 途中で失敗した場合は、前回のデータが残る。
 */
export async function saveChampionMaster(db: Database, input: ChampionMasterInput): Promise<void> {
  if (input.champions.length < MIN_CHAMPIONS) {
    throw new Error(
      `チャンピオン数が ${input.champions.length} 件で、最低件数(${MIN_CHAMPIONS})を下回るため、保存を中止しました`,
    );
  }

  await db.transaction(async (tx) => {
    await buildChampionUpsert(tx, input.champions);

    await tx.update(patches).set({ isCurrent: false });
    await tx
      .insert(patches)
      .values({ version: input.patch, isCurrent: true })
      .onDuplicateKeyUpdate({ set: { isCurrent: true } });
  });
}

export async function listChampions(db: Database): Promise<ChampionRow[]> {
  return db.select().from(champions).orderBy(asc(champions.numericKey));
}

/** 現在のパッチ(例: "16.22")。未取り込みなら null。 */
export async function getCurrentPatch(db: Database): Promise<string | null> {
  const rows = await db
    .select({ version: patches.version })
    .from(patches)
    .where(eq(patches.isCurrent, true))
    .limit(1);
  return rows[0]?.version ?? null;
}
