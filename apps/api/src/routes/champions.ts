import { championsResponseSchema } from "@draftgg/shared";
import type { ChampionsResponse } from "@draftgg/shared";
import { Hono } from "hono";

/** DB から読んだチャンピオン行(api が必要とする列だけ) */
export interface ChampionSource {
  id: string;
  numericKey: number;
  nameJa: string;
  nameEn: string;
  tags: string[];
  damageType: "ad" | "ap" | "mixed" | null;
  imageVersion: string;
}

export interface ChampionsReader {
  getCurrentPatch(): Promise<string | null>;
  listChampions(): Promise<ChampionSource[]>;
}

export function createChampionsRoute(reader: ChampionsReader) {
  return new Hono().get("/", async (c) => {
    const [patch, rows] = await Promise.all([reader.getCurrentPatch(), reader.listChampions()]);

    const body: ChampionsResponse = championsResponseSchema.parse({
      patch,
      champions: rows.map((row) => ({
        id: row.id,
        numericKey: row.numericKey,
        nameJa: row.nameJa,
        nameEn: row.nameEn,
        tags: row.tags,
        damageType: row.damageType,
        imageVersion: row.imageVersion,
      })),
    });

    // マスタは1日1回しか更新されないため、短時間のキャッシュを許可する
    c.header("Cache-Control", "public, max-age=300");
    return c.json(body);
  });
}
