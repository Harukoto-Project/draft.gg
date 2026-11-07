import { POSITIONS } from "@draftgg/shared";
import {
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  varchar,
} from "drizzle-orm/mysql-core";

const rate = (name: string) => decimal(name, { precision: 6, scale: 4 }).notNull();

export const metaStats = mysqlTable(
  "meta_stats",
  {
    patch: varchar("patch", { length: 16 }).notNull(),
    tier: varchar("tier", { length: 32 }).notNull(),
    position: mysqlEnum("position", POSITIONS).notNull(),
    championId: varchar("champion_id", { length: 64 }).notNull(),
    games: int("games").notNull(),
    winRate: rate("win_rate"),
    pickRate: rate("pick_rate"),
    banRate: rate("ban_rate"),
    roleRate: rate("role_rate"),
    /** OP.GG のティア(1=強い … 5=弱い) */
    tierRank: smallint("tier_rank").notNull(),
    fetchedAt: datetime("fetched_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.patch, table.tier, table.position, table.championId],
    }),
  ],
);
