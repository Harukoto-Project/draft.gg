import { z } from "zod";

import { ID_MAX_LENGTH } from "./draft.js";
import { POSITIONS } from "./position.js";

/** 1ユーザーが持てるプレイヤー数。チーム 5 人 + 余裕 */
export const MAX_PROFILES_PER_USER = 30;

/** 1プレイヤーのプールの最大件数(チャンピオン × ロール) */
export const MAX_POOL_ENTRIES = 100;

/** OP.GG のプロフィール取得で指定できるリージョン */
export const RIOT_REGIONS = [
  "JP",
  "KR",
  "NA",
  "EUW",
  "EUNE",
  "OCE",
  "BR",
  "LAN",
  "LAS",
  "RU",
  "TR",
  "SG",
  "PH",
  "TW",
  "TH",
  "VN",
] as const;

export type RiotRegion = (typeof RIOT_REGIONS)[number];

export const DEFAULT_RIOT_REGION: RiotRegion = "JP";

/** プール同期の最短間隔(同じプレイヤーに対して) */
export const POOL_SYNC_INTERVAL_MS = 10 * 60 * 1000;

const GAME_NAME_MAX = 16;
const TAG_LINE_MAX = 5;

export interface RiotId {
  gameName: string;
  tagLine: string;
}

/** `ゲーム名#タグ` を分ける。形が違えば null */
export function parseRiotId(value: string): RiotId | null {
  const text = value.trim();
  const index = text.lastIndexOf("#");
  if (index < 0) return null;
  const gameName = text.slice(0, index).trim();
  const tagLine = text.slice(index + 1).trim();
  if (gameName.length < 1 || gameName.length > GAME_NAME_MAX || gameName.includes("#")) return null;
  if (tagLine.length < 1 || tagLine.length > TAG_LINE_MAX) return null;
  return { gameName, tagLine };
}

export const POOL_SOURCES = ["opgg", "manual"] as const;

export type PoolSource = (typeof POOL_SOURCES)[number];

export const poolEntrySchema = z.object({
  championId: z.string().min(1).max(ID_MAX_LENGTH),
  position: z.enum(POSITIONS),
  source: z.enum(POOL_SOURCES),
  /** 手動で足したものは null */
  games: z.number().int().nonnegative().nullable(),
  winRate: z.number().min(0).max(1).nullable(),
  /** true のときは、プールに無いものとして扱う */
  excluded: z.boolean(),
});

export type PoolEntry = z.infer<typeof poolEntrySchema>;

/** 同じチャンピオン × ロールを重複させない */
function hasUniqueEntries(entries: PoolEntry[]): boolean {
  return (
    new Set(entries.map((entry) => `${entry.championId}:${entry.position}`)).size === entries.length
  );
}

export const poolEntriesSchema = z
  .array(poolEntrySchema)
  .max(MAX_POOL_ENTRIES)
  .refine(hasUniqueEntries, { message: "チャンピオンとロールの組み合わせが重複しています" });

const displayNameSchema = z.string().trim().min(1).max(50);

const riotIdSchema = z
  .string()
  .trim()
  .max(GAME_NAME_MAX + TAG_LINE_MAX + 1)
  .refine((value) => parseRiotId(value) !== null, {
    message: "ゲーム名#タグ の形で入力してください",
  });

const rolesSchema = z
  .array(z.enum(POSITIONS))
  .max(POSITIONS.length)
  .refine((roles) => new Set(roles).size === roles.length, { message: "ロールが重複しています" });

/** プレイヤーの作成・更新で受け取る項目(更新は一部だけでもよい) */
export const profileInputSchema = z.object({
  displayName: displayNameSchema,
  riotId: riotIdSchema.nullable(),
  region: z.enum(RIOT_REGIONS).nullable(),
  roles: rolesSchema,
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const profilePatchSchema = profileInputSchema.partial();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  riotId: z.string().nullable(),
  region: z.enum(RIOT_REGIONS).nullable(),
  roles: z.array(z.enum(POSITIONS)),
  /** 最後に OP.GG から取得した日時(ISO 8601)。未同期なら null */
  syncedAt: z.string().nullable(),
  pool: z.array(poolEntrySchema),
});

export type Profile = z.infer<typeof profileSchema>;

export const profilesResponseSchema = z.object({
  profiles: z.array(profileSchema),
});

export type ProfilesResponse = z.infer<typeof profilesResponseSchema>;

export const poolUpdateSchema = z.object({
  entries: poolEntriesSchema,
});

export type PoolUpdate = z.infer<typeof poolUpdateSchema>;
