import { POSITIONS } from "@draftgg/shared";
import {
  datetime,
  index,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { user } from "./auth.js";
import { playerProfiles } from "./profiles.js";

/** ユーザーが登録するチーム(5人のロール割り当て) */
export const teams = mysqlTable(
  "teams",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("teams_owner_id_idx").on(table.ownerId)],
);

export const teamMembers = mysqlTable(
  "team_members",
  {
    teamId: varchar("team_id", { length: 36 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    position: mysqlEnum("position", POSITIONS).notNull(),
    profileId: varchar("profile_id", { length: 36 })
      .notNull()
      .references(() => playerProfiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.position] }),
    // 同じプレイヤーは、同じチームに 1 回だけ
    uniqueIndex("team_members_team_profile_uq").on(table.teamId, table.profileId),
  ],
);
