import { POSITIONS, POOL_SOURCES } from "@draftgg/shared";
import type { Position } from "@draftgg/shared";
import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  varchar,
} from "drizzle-orm/mysql-core";

import { user } from "./auth.js";

/** ユーザーが登録するプレイヤー(自分、チームメイトなど) */
export const playerProfiles = mysqlTable(
  "player_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 50 }).notNull(),
    /** `ゲーム名#タグ`。OP.GG からプールを取るときだけ使う */
    riotId: varchar("riot_id", { length: 32 }),
    region: varchar("region", { length: 8 }),
    roles: json("roles").$type<Position[]>().notNull(),
    syncedAt: datetime("synced_at", { fsp: 3 }),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("player_profiles_owner_id_idx").on(table.ownerId)],
);

export const playerPoolEntries = mysqlTable(
  "player_pool_entries",
  {
    profileId: varchar("profile_id", { length: 36 })
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
    championId: varchar("champion_id", { length: 64 }).notNull(),
    position: mysqlEnum("position", POSITIONS).notNull(),
    source: mysqlEnum("source", POOL_SOURCES).notNull(),
    games: int("games"),
    winRate: decimal("win_rate", { precision: 6, scale: 4 }),
    excluded: boolean("excluded").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.championId, table.position] })],
);
