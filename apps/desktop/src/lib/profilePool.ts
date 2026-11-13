import { MAX_POOL_ENTRIES } from "@draftgg/shared";
import type { PoolEntry, Position } from "@draftgg/shared";

export function entryKey(entry: Pick<PoolEntry, "championId" | "position">): string {
  return `${entry.championId}:${entry.position}`;
}

/** 試合数が多い順。手動追加(試合数なし)は OP.GG 由来の後ろ */
export function sortPool(entries: readonly PoolEntry[]): PoolEntry[] {
  return [...entries].sort(
    (a, b) => (b.games ?? -1) - (a.games ?? -1) || entryKey(a).localeCompare(entryKey(b)),
  );
}

export function canAddEntry(entries: readonly PoolEntry[]): boolean {
  return entries.length < MAX_POOL_ENTRIES;
}

/** 手動で追加する。同じチャンピオン × ロールが既にあれば、そのまま返す */
export function addManualEntry(
  entries: readonly PoolEntry[],
  championId: string,
  position: Position,
): PoolEntry[] {
  if (entries.some((entry) => entry.championId === championId && entry.position === position)) {
    return [...entries];
  }
  return [
    ...entries,
    { championId, position, source: "manual", games: null, winRate: null, excluded: false },
  ];
}

export function setExcluded(
  entries: readonly PoolEntry[],
  target: PoolEntry,
  excluded: boolean,
): PoolEntry[] {
  return entries.map((entry) =>
    entryKey(entry) === entryKey(target) ? { ...entry, excluded } : entry,
  );
}

export function removeEntry(entries: readonly PoolEntry[], target: PoolEntry): PoolEntry[] {
  return entries.filter((entry) => entryKey(entry) !== entryKey(target));
}
