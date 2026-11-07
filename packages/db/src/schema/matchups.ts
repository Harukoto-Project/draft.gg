import { POSITIONS } from "@draftgg/shared";
import { decimal, int, mysqlEnum, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

export const matchups = mysqlTable(
  "matchups",
  {
    patch: varchar("patch", { length: 16 }).notNull(),
    tier: varchar("tier", { length: 32 }).notNull(),
    position: mysqlEnum("position", POSITIONS).notNull(),
    championId: varchar("champion_id", { length: 64 }).notNull(),
    opponentId: varchar("opponent_id", { length: 64 }).notNull(),
    games: int("games").notNull(),
    /** champion_id 側の勝率 */
    winRate: decimal("win_rate", { precision: 6, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.patch, table.tier, table.position, table.championId, table.opponentId],
    }),
  ],
);
