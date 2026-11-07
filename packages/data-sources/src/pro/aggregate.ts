import {
  EARLY_PICK_THROUGH,
  POSITIONS,
  PRO_LEAGUES,
  PRO_SCOPE_MAJOR,
  proStatsScope,
  selectRecentProPatches,
} from "@draftgg/shared";
import type { Position, ProChampionStatRow, ProGameDraft } from "@draftgg/shared";

interface PickCount {
  picks: number;
  wins: number;
  orderedPicks: number;
  earlyPicks: number;
}

/**
 * 試合が 20 件以上あるパッチのうち新しい 2 つを、major・リーグ別・パッチ別に集計する。
 * 条件を満たすパッチが無いときは空を返す(前回の統計を消さないため、保存側で中止する)。
 */
export function aggregateProStats(games: ProGameDraft[], computedAt: Date): ProChampionStatRow[] {
  const counts = new Map<string, number>();
  for (const game of games) counts.set(game.patch, (counts.get(game.patch) ?? 0) + 1);
  const patches = selectRecentProPatches(
    [...counts].map(([patch, count]) => ({ patch, games: count })),
  );
  if (patches.length === 0) return [];

  const window = new Set(patches);
  const inWindow = games.filter((game) => window.has(game.patch));
  const rows = statsFor(inWindow, PRO_SCOPE_MAJOR, computedAt);

  for (const league of PRO_LEAGUES) {
    const leagueGames = inWindow.filter((game) => game.league === league);
    if (leagueGames.length === 0) continue;
    rows.push(...statsFor(leagueGames, proStatsScope(league), computedAt));
    for (const patch of patches) {
      const both = leagueGames.filter((game) => game.patch === patch);
      if (both.length === 0) continue;
      rows.push(...statsFor(both, proStatsScope(league, patch), computedAt));
    }
  }

  for (const patch of patches) {
    const patchGames = inWindow.filter((game) => game.patch === patch);
    if (patchGames.length === 0) continue;
    rows.push(...statsFor(patchGames, proStatsScope(undefined, patch), computedAt));
  }

  return rows;
}

function statsFor(games: ProGameDraft[], scope: string, computedAt: Date): ProChampionStatRow[] {
  const picks = new Map<string, Map<Position, PickCount>>();
  const bans = new Map<string, number>();

  for (const game of games) {
    const banned = new Set<string>();
    for (const action of game.actions) {
      if (action.type === "ban") {
        if (banned.has(action.championId)) continue;
        banned.add(action.championId);
        bans.set(action.championId, (bans.get(action.championId) ?? 0) + 1);
        continue;
      }
      if (!action.position) continue;
      const byPosition = picks.get(action.championId) ?? new Map<Position, PickCount>();
      const count = byPosition.get(action.position) ?? {
        picks: 0,
        wins: 0,
        orderedPicks: 0,
        earlyPicks: 0,
      };
      count.picks += 1;
      if (action.side === game.winnerSide) count.wins += 1;
      if (action.order !== null) {
        count.orderedPicks += 1;
        if (action.order <= EARLY_PICK_THROUGH) count.earlyPicks += 1;
      }
      byPosition.set(action.position, count);
      picks.set(action.championId, byPosition);
    }
  }

  const championIds = new Set([...picks.keys(), ...bans.keys()]);
  const rows: ProChampionStatRow[] = [];
  for (const championId of championIds) {
    const banCount = bans.get(championId) ?? 0;
    const byPosition = picks.get(championId);
    const positions = byPosition && byPosition.size > 0 ? [...byPosition.keys()] : [...POSITIONS];
    for (const position of positions) {
      const count = byPosition?.get(position);
      const pickCount = count?.picks ?? 0;
      if (pickCount === 0 && banCount === 0) continue;
      rows.push({
        scope,
        championId,
        position,
        games: games.length,
        picks: pickCount,
        bans: banCount,
        presence: presence(pickCount, banCount, games.length),
        winRate: pickCount > 0 && count ? count.wins / pickCount : null,
        earlyPickRate:
          count && count.orderedPicks > 0 ? count.earlyPicks / count.orderedPicks : null,
        computedAt,
      });
    }
  }
  return rows;
}

function presence(picks: number, bans: number, games: number): number {
  if (games <= 0) return 0;
  return Math.min(1, (picks + bans) / games);
}
