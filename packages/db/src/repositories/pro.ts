import {
  POSITIONS,
  PRO_SCOPE_MAJOR,
  isProLeague,
  proStatsScope,
  selectRecentProPatches,
} from "@draftgg/shared";
import type {
  ProChampionStatRow,
  ProChampionsResponse,
  ProDraftAction,
  ProGameDraft,
  ProLeague,
} from "@draftgg/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

import type { Database } from "../client.js";
import { champions, proChampionStats, proGameActions, proGames } from "../schema/index.js";

const GAME_CHUNK = 40;
const INSERT_CHUNK = 200;

export interface ProOrderFill {
  gameKey: string;
  orders: Array<{ championId: string; type: ProDraftAction["type"]; order: number }>;
}

type Writer = Pick<Database, "insert">;

function valuesOf(column: AnyMySqlColumn) {
  return sql`values(${sql.identifier(column.name)})`;
}

function rate(value: number): string {
  return value.toFixed(4);
}

export function buildProGameUpsert(db: Writer, games: ProGameDraft[]) {
  return db
    .insert(proGames)
    .values(
      games.map((game) => ({
        gameKey: game.gameKey,
        league: game.league,
        event: game.event,
        playedAt: game.playedAt,
        gameNumber: game.gameNumber,
        patch: game.patch,
        blueTeam: game.blueTeam,
        redTeam: game.redTeam,
        winnerSide: game.winnerSide,
        sources: { oraclesElixir: true, leaguepedia: false },
      })),
    )
    .onDuplicateKeyUpdate({
      set: {
        league: valuesOf(proGames.league),
        event: valuesOf(proGames.event),
        playedAt: valuesOf(proGames.playedAt),
        gameNumber: valuesOf(proGames.gameNumber),
        patch: valuesOf(proGames.patch),
        blueTeam: valuesOf(proGames.blueTeam),
        redTeam: valuesOf(proGames.redTeam),
        winnerSide: valuesOf(proGames.winnerSide),
        sources: valuesOf(proGames.sources),
      },
    });
}

/** 同じ game_key は上書きし、その試合のピックと BAN は入れ替える */
export async function saveProGames(db: Database, games: ProGameDraft[]): Promise<void> {
  for (const chunk of chunks(games, GAME_CHUNK)) {
    await db.transaction(async (tx) => {
      await buildProGameUpsert(tx, chunk);
      const ids = await tx
        .select({ id: proGames.id, gameKey: proGames.gameKey })
        .from(proGames)
        .where(
          inArray(
            proGames.gameKey,
            chunk.map((game) => game.gameKey),
          ),
        );
      const idByKey = new Map(ids.map((row) => [row.gameKey, row.id]));
      const gameIds = ids.map((row) => row.id);
      if (gameIds.length > 0) {
        await tx.delete(proGameActions).where(inArray(proGameActions.gameId, gameIds));
      }
      const actions = chunk.flatMap((game) => {
        const gameId = idByKey.get(game.gameKey);
        if (gameId === undefined) return [];
        return game.actions.map((action) => ({
          gameId,
          side: action.side,
          type: action.type,
          order: action.order,
          position: action.position,
          championId: action.championId,
        }));
      });
      for (const actionChunk of chunks(actions, INSERT_CHUNK)) {
        await tx.insert(proGameActions).values(actionChunk);
      }
    });
  }
}

/**
 * 順番が空の手だけ埋める。Leaguepedia で突き合った試合は sources.leaguepedia を true にする。
 * 埋めた試合数を返す。
 */
export async function fillProOrders(db: Database, fills: ProOrderFill[]): Promise<number> {
  if (fills.length === 0) return 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const chunk of chunks(fills, GAME_CHUNK)) {
      const ids = await tx
        .select({ id: proGames.id, gameKey: proGames.gameKey })
        .from(proGames)
        .where(
          inArray(
            proGames.gameKey,
            chunk.map((fill) => fill.gameKey),
          ),
        );
      const idByKey = new Map(ids.map((row) => [row.gameKey, row.id]));
      for (const fill of chunk) {
        const gameId = idByKey.get(fill.gameKey);
        if (gameId === undefined || fill.orders.length === 0) continue;
        for (const order of fill.orders) {
          await tx
            .update(proGameActions)
            .set({ order: order.order })
            .where(
              and(
                eq(proGameActions.gameId, gameId),
                eq(proGameActions.championId, order.championId),
                eq(proGameActions.type, order.type),
                isNull(proGameActions.order),
              ),
            );
        }
        await tx
          .update(proGames)
          .set({ sources: { oraclesElixir: true, leaguepedia: true } })
          .where(eq(proGames.id, gameId));
        updated += 1;
      }
    }
  });
  return updated;
}

/** 集計と Leaguepedia の突き合わせが読む、保存済みの試合 */
export async function listStoredProGames(db: Database): Promise<ProGameDraft[]> {
  const [games, actions] = await Promise.all([
    db.select().from(proGames),
    db.select().from(proGameActions),
  ]);
  const byGame = new Map<number, ProDraftAction[]>();
  for (const action of actions) {
    const list = byGame.get(action.gameId) ?? [];
    list.push({
      side: action.side,
      type: action.type,
      order: action.order,
      position: action.position,
      championId: action.championId,
    });
    byGame.set(action.gameId, list);
  }

  return games.flatMap((game) => {
    if (!isProLeague(game.league)) return [];
    return [
      {
        gameKey: game.gameKey,
        league: game.league,
        event: game.event,
        playedAt: game.playedAt,
        gameNumber: game.gameNumber,
        patch: game.patch,
        blueTeam: game.blueTeam,
        redTeam: game.redTeam,
        winnerSide: game.winnerSide,
        actions: byGame.get(game.id) ?? [],
      },
    ];
  });
}

/** 件数が足りないときは投げて、前回の pro_champion_stats を残す */
export async function replaceProChampionStats(
  db: Database,
  rows: ProChampionStatRow[],
): Promise<void> {
  if (rows.length === 0) {
    throw new Error("集計できるプロ試合が足りないため、前回の統計を残します");
  }
  await db.transaction(async (tx) => {
    await tx.delete(proChampionStats);
    for (const chunk of chunks(rows, INSERT_CHUNK)) {
      await tx.insert(proChampionStats).values(
        chunk.map((row) => ({
          scope: row.scope,
          championId: row.championId,
          position: row.position,
          games: row.games,
          picks: row.picks,
          bans: row.bans,
          presence: rate(row.presence),
          winRate: row.winRate === null ? null : rate(row.winRate),
          earlyPickRate: row.earlyPickRate === null ? null : rate(row.earlyPickRate),
          computedAt: row.computedAt,
        })),
      );
    }
  });
}

export async function loadProChampions(
  db: Database,
  query: { league?: ProLeague; patch?: string },
): Promise<ProChampionsResponse> {
  const counts = await db
    .select({ patch: proGames.patch, games: sql<string | number>`count(*)` })
    .from(proGames)
    .groupBy(proGames.patch);
  const recent = selectRecentProPatches(
    counts.map((row) => ({ patch: row.patch, games: Number(row.games) })),
  );
  const scope = proStatsScope(query.league, query.patch);
  const [statRows, championRows] = await Promise.all([
    db.select().from(proChampionStats).where(eq(proChampionStats.scope, scope)),
    db.select({ id: champions.id, nameJa: champions.nameJa }).from(champions),
  ]);
  const names = new Map(championRows.map((row) => [row.id, row.nameJa]));
  const stats = statRows
    .map((row) => ({
      championId: row.championId,
      nameJa: names.get(row.championId) ?? row.championId,
      position: row.position,
      games: row.games,
      picks: row.picks,
      bans: row.bans,
      presence: asNumber(row.presence),
      winRate: asNullableNumber(row.winRate),
      earlyPickRate: asNullableNumber(row.earlyPickRate),
    }))
    .sort((a, b) => {
      const presence = b.presence - a.presence;
      const position = POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
      return presence || position || a.championId.localeCompare(b.championId);
    });

  return { scope, patches: query.patch ? [query.patch] : recent, stats };
}

export async function loadMajorProStats(db: Database) {
  const rows = await db
    .select()
    .from(proChampionStats)
    .where(eq(proChampionStats.scope, PRO_SCOPE_MAJOR));
  return rows.map((row) => ({
    championId: row.championId,
    position: row.position,
    games: row.games,
    picks: row.picks,
    bans: row.bans,
    presence: asNumber(row.presence),
    winRate: asNullableNumber(row.winRate),
    earlyPickRate: asNullableNumber(row.earlyPickRate),
  }));
}

function asNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("プロ統計の率を数値にできません");
  return parsed;
}

function asNullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return asNumber(value);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
