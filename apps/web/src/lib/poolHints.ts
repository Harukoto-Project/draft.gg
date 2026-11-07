import type { PoolHints, Position, Profile } from "@draftgg/shared";

/** 提案に渡すプール。そのロールの、除外していない項目だけ。1件も無ければ渡さない */
export function buildPoolHints(
  profile: Profile | undefined,
  position: Position | null,
): PoolHints | undefined {
  if (!profile || !position) return undefined;
  const entries = profile.pool
    .filter((entry) => entry.position === position && !entry.excluded)
    .map(({ championId, games, winRate }) => ({ championId, games, winRate }));
  return entries.length > 0 ? { [position]: entries } : undefined;
}
