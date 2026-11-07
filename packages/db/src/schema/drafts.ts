import { DRAFT_FORMATS, SIDES } from "@draftgg/shared";
import type { DraftState } from "@draftgg/shared";
import { datetime, index, json, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";

import { user } from "./auth.js";

/** ユーザーが保存したドラフト。`state` はドラフト状態をそのまま持つ */
export const drafts = mysqlTable(
  "drafts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    format: mysqlEnum("format", DRAFT_FORMATS).notNull(),
    mySide: mysqlEnum("my_side", SIDES).notNull(),
    state: json("state").$type<DraftState>().notNull(),
    note: varchar("note", { length: 200 }).notNull().default(""),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("drafts_owner_id_created_at_idx").on(table.ownerId, table.createdAt)],
);
