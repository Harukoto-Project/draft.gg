import { MAX_POOL_ENTRIES } from "./profile.js";
import type { PoolEntry } from "./profile.js";
import { POSITIONS } from "./position.js";
import type { Position } from "./position.js";
import { MAJOR_ROLE_RATE } from "./tier.js";
import type { MetaStat } from "./stats.js";

/**
 * OP.GG の使用履歴にはロールが無いため、チャンピオンのロールをメタ統計から決める。
 * プレイヤーのロールが決まっていれば、その中で最も多いロールを選ぶ(主要ロールのみ)。
 * 決まっていなければ、そのチャンピオンの最も多いロール。当てはまらなければ null。
 */
export function resolvePoolPosition(
  championId: string,
  meta: readonly MetaStat[],
  roles: readonly Position[],
): Position | null {
  const allowed = roles.length > 0 ? roles : POSITIONS;
  let best: MetaStat | null = null;
  for (const row of meta) {
    if (row.championId !== championId || row.roleRate < MAJOR_ROLE_RATE) continue;
    if (!allowed.includes(row.position)) continue;
    if (!best || row.roleRate > best.roleRate) best = row;
  }
  return best?.position ?? null;
}

function keyOf(entry: Pick<PoolEntry, "championId" | "position">): string {
  return `${entry.championId}:${entry.position}`;
}

/**
 * OP.GG から取り直したプールを、いまのプールへ反映する。
 * - 手動で足したものはそのまま残す(同じチャンピオン × ロールが OP.GG にもあれば手動を優先)
 * - OP.GG 由来は入れ替える。除外の指定は、引き続き出てくるものについて引き継ぐ
 */
export function mergeSyncedPool(existing: PoolEntry[], synced: PoolEntry[]): PoolEntry[] {
  const manual = existing.filter((entry) => entry.source === "manual");
  const manualKeys = new Set(manual.map(keyOf));
  const previousExcluded = new Set(
    existing.filter((entry) => entry.source === "opgg" && entry.excluded).map(keyOf),
  );

  const fromOpgg = synced
    .filter((entry) => !manualKeys.has(keyOf(entry)))
    .map((entry) => ({ ...entry, excluded: previousExcluded.has(keyOf(entry)) }));

  return [...manual, ...fromOpgg].slice(0, MAX_POOL_ENTRIES);
}
