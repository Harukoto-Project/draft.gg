import type { ChampionRef } from "@draftgg/shared";

/** Data Dragon の英語名と、OP.GG が受け付けるキーが一致しないチャンピオン。 */
const KEY_OVERRIDES: Record<string, string> = {
  "nunu & willump": "NUNU",
};

/**
 * OP.GG の champion 引数。英語名から記号を除き、区切りをアンダースコアにした大文字。
 * 例: "Lee Sin" → LEE_SIN、"Kai'Sa" → KAISA、"Dr. Mundo" → DR_MUNDO。
 */
export function toOpggChampionKey(nameEn: string): string {
  const override = KEY_OVERRIDES[nameEn.toLowerCase()];
  if (override) return override;
  return nameEn
    .replace(/[''.]/g, "")
    .replace(/&/g, " ")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function normalizeChampionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function createNameIndex(catalog: ChampionRef[]): Map<string, ChampionRef> {
  const index = new Map<string, ChampionRef>();
  for (const champion of catalog) {
    index.set(normalizeChampionName(champion.nameEn), champion);
    index.set(normalizeChampionName(champion.id), champion);
  }
  return index;
}

export function createNumericIndex(catalog: ChampionRef[]): Map<number, ChampionRef> {
  return new Map(catalog.map((champion) => [champion.numericKey, champion]));
}
