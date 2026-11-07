import { POSITIONS } from "@draftgg/shared";
import { decimal, int, mysqlEnum, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

export const synergies = mysqlTable(
  "synergies",
  {
    patch: varchar("patch", { length: 16 }).notNull(),
    tier: varchar("tier", { length: 32 }).notNull(),
    championId: varchar("champion_id", { length: 64 }).notNull(),
    position: mysqlEnum("position", POSITIONS).notNull(),
    allyId: varchar("ally_id", { length: 64 }).notNull(),
    allyPosition: mysqlEnum("ally_position", POSITIONS).notNull(),
    games: int("games").notNull(),
    winRate: decimal("win_rate", { precision: 6, scale: 4 }).notNull(),
    score: decimal("score", { precision: 10, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({
      // 自動生成の名前は MySQL の識別子の上限(64 文字)を超えるので、短い名前を付ける
      name: "synergies_pk",
      columns: [
        table.patch,
        table.tier,
        table.championId,
        table.position,
        table.allyId,
        table.allyPosition,
      ],
    }),
  ],
);
