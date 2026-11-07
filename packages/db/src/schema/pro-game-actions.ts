import { POSITIONS, PRO_ACTION_TYPES, SIDES } from "@draftgg/shared";
import {
  bigint,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  varchar,
} from "drizzle-orm/mysql-core";

import { proGames } from "./pro-games.js";

export const proGameActions = mysqlTable(
  "pro_game_actions",
  {
    gameId: bigint("game_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => proGames.id, { onDelete: "cascade" }),
    side: mysqlEnum("side", SIDES).notNull(),
    type: mysqlEnum("type", PRO_ACTION_TYPES).notNull(),
    /** ドラフト全体での順番。不明なら null */
    order: smallint("order"),
    /** ピックだけ。BAN は null */
    position: mysqlEnum("position", POSITIONS),
    championId: varchar("champion_id", { length: 64 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.championId] }),
    index("pro_game_actions_champion_id_idx").on(table.championId),
  ],
);
