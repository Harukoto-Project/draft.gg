import { POSITIONS } from "@draftgg/shared";
import {
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  varchar,
} from "drizzle-orm/mysql-core";

const rate = (name: string) => decimal(name, { precision: 6, scale: 4 });

export const proChampionStats = mysqlTable(
  "pro_champion_stats",
  {
    scope: varchar("scope", { length: 64 }).notNull(),
    championId: varchar("champion_id", { length: 64 }).notNull(),
    position: mysqlEnum("position", POSITIONS).notNull(),
    /** scope に含まれる試合数 */
    games: int("games").notNull(),
    picks: int("picks").notNull(),
    /** チャンピオン全体の BAN 数 */
    bans: int("bans").notNull(),
    presence: rate("presence").notNull(),
    winRate: rate("win_rate"),
    earlyPickRate: rate("early_pick_rate"),
    computedAt: datetime("computed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.championId, table.position] })],
);
