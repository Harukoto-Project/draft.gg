import type { ProChampionsResponse } from "@draftgg/shared";

export type ProStatRow = ProChampionsResponse["stats"][number];

export type ProSortKey = "name" | "games" | "picks" | "bans" | "presence" | "winRate" | "early";

export type SortDirection = "asc" | "desc";

/** 勝率などが無い行(null)は、並べる向きに関わらず最後に置く */
export function sortProStats(
  rows: readonly ProStatRow[],
  key: ProSortKey,
  direction: SortDirection,
): ProStatRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") {
      return sign * a.nameJa.localeCompare(b.nameJa, "ja") || a.position.localeCompare(b.position);
    }
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left === null && right === null) return a.championId.localeCompare(b.championId);
    if (left === null) return 1;
    if (right === null) return -1;
    return sign * (left - right) || a.championId.localeCompare(b.championId);
  });
}

function sortValue(row: ProStatRow, key: Exclude<ProSortKey, "name">): number | null {
  switch (key) {
    case "games":
      return row.games;
    case "picks":
      return row.picks;
    case "bans":
      return row.bans;
    case "presence":
      return row.presence;
    case "winRate":
      return row.winRate;
    case "early":
      return row.earlyPickRate;
  }
}

/** 0〜1 の率を「54.2%」にする。無いときは「-」 */
export function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}
