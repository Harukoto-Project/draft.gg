import { DAMAGE_TYPES } from "@draftgg/shared";
import { int, json, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const champions = mysqlTable("champions", {
  /** Data Dragon のキー(例: "Ahri") */
  id: varchar("id", { length: 64 }).primaryKey(),
  numericKey: int("numeric_key").notNull().unique(),
  nameJa: varchar("name_ja", { length: 64 }).notNull(),
  nameEn: varchar("name_en", { length: 64 }).notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  /** OP.GG のメタ統計の取り込み(M2)で入る */
  damageType: mysqlEnum("damage_type", DAMAGE_TYPES),
  /** 構成評価用の属性。リポジトリ内の JSON から取り込む(M5) */
  traits: json("traits").$type<Record<string, unknown>>(),
  imageVersion: varchar("image_version", { length: 32 }).notNull(),
});
