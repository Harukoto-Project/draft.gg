import { z } from "zod";

export const DAMAGE_TYPES = ["ad", "ap", "mixed"] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

export const championSchema = z.object({
  /** Data Dragon のキー(例: "Ahri")。画像URLにも使う */
  id: z.string().min(1),
  /** Riot の数値ID(例: 103) */
  numericKey: z.number().int(),
  nameJa: z.string().min(1),
  nameEn: z.string().min(1),
  /** Data Dragon のタグ(Mage / Assassin など) */
  tags: z.array(z.string()),
  /** メタ統計の取り込み後に入る。未取得は null */
  damageType: z.enum(DAMAGE_TYPES).nullable(),
  /** 画像取得に使う Data Dragon のバージョン(例: "16.21.1") */
  imageVersion: z.string().min(1),
});

export type Champion = z.infer<typeof championSchema>;

export const championsResponseSchema = z.object({
  /** 現在のパッチ(例: "16.21")。未取り込みなら null */
  patch: z.string().nullable(),
  champions: z.array(championSchema),
});

export type ChampionsResponse = z.infer<typeof championsResponseSchema>;
