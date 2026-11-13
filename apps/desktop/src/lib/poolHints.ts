import { POSITIONS } from "@draftgg/shared";
import type { PoolHints, Position, Profile, Team } from "@draftgg/shared";

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

/** チームの各ロールに割り当てたプレイヤーのプール。1件も無ければ渡さない */
export function buildTeamPoolHints(
  team: Team | undefined,
  profiles: readonly Profile[],
): PoolHints | undefined {
  if (!team) return undefined;
  const hints: PoolHints = {};
  for (const position of POSITIONS) {
    const profileId = team.members[position];
    const profile = profileId ? profiles.find((item) => item.id === profileId) : undefined;
    const roleHints = buildPoolHints(profile, position)?.[position];
    if (roleHints) hints[position] = roleHints;
  }
  return Object.keys(hints).length > 0 ? hints : undefined;
}
