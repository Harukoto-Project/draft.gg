import type { ProGameSources } from "@draftgg/shared";
import { SIDES } from "@draftgg/shared";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";

export const proGames = mysqlTable(
  "pro_games",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    gameKey: varchar("game_key", { length: 191 }).notNull().unique(),
    league: varchar("league", { length: 32 }).notNull(),
    event: varchar("event", { length: 64 }).notNull(),
    playedAt: datetime("played_at").notNull(),
    /** シリーズ内の何試合目か。Leaguepedia との突き合わせに使う */
    gameNumber: varchar("game_number", { length: 16 }).notNull(),
    patch: varchar("patch", { length: 16 }).notNull(),
    blueTeam: varchar("blue_team", { length: 128 }).notNull(),
    redTeam: varchar("red_team", { length: 128 }).notNull(),
    winnerSide: mysqlEnum("winner_side", SIDES).notNull(),
    sources: json("sources").$type<ProGameSources>().notNull(),
  },
  (table) => [index("pro_games_patch_league_idx").on(table.patch, table.league)],
);
