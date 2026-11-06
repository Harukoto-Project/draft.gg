import { boolean, datetime, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const patches = mysqlTable("patches", {
  /** パッチ番号(例: "16.22") */
  version: varchar("version", { length: 16 }).primaryKey(),
  /** 公開日。Data Dragon からは取れないため、取得できるようになるまで NULL */
  releasedAt: datetime("released_at"),
  isCurrent: boolean("is_current").notNull().default(false),
});
