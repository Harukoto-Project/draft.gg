import {
  BAN_FACTORS,
  MAJOR_ROLE_RATE,
  PICK_FACTORS,
  POSITION_LABELS,
  POSITIONS,
  SIDES,
} from "@draftgg/shared";
import type {
  BanFactor,
  BanWeights,
  DraftState,
  MatchupStat,
  MetaStat,
  PickFactor,
  PoolHintEntry,
  PoolHints,
  PickWeights,
  Position,
  Preset,
  RecommendationCandidate,
  RecommendationResponse,
  Side,
  StatsSnapshot,
  SynergyStat,
  ProStat,
} from "@draftgg/shared";

import {
  formatGames,
  formatRate,
  markRoleUncertain,
  round4,
  scoreBanMeta,
  scorePickMeta,
  scorePool,
  scoreProBan,
  scoreProPick,
  scoreWinSamples,
} from "./score.js";
import type { Scored } from "./score.js";

export interface RecommendInput {
  draft: DraftState;
  snapshot: StatsSnapshot;
  preset: Preset;
  limit: number;
  pickWeights: PickWeights;
  banWeights: BanWeights;
  /** ロールごとの担当プレイヤーのプール。渡したロールだけ、プールの要素を計算する。 */
  pools?: PoolHints;
}

interface Indexes {
  names: Map<string, string>;
  meta: Map<string, MetaStat>;
  metaByPosition: Map<Position, MetaStat[]>;
  matchups: Map<string, MatchupStat>;
  synergies: Map<string, SynergyStat>;
  pro: Map<string, ProStat>;
  proByChampion: Map<string, ProStat[]>;
}

interface Part {
  factor: PickFactor | BanFactor;
  weight: number;
  scored: Scored;
}

export function recommend(input: RecommendInput): RecommendationResponse {
  const indexes = buildIndexes(input.snapshot);
  const excluded = excludedChampions(input.draft);
  const picks = targetPositions(input.draft).map((position) => ({
    position,
    candidates: rankPicks(input, indexes, excluded, position),
  }));

  return {
    patch: input.snapshot.patch,
    tier: input.snapshot.tier,
    preset: input.preset,
    picks,
    bans: rankBans(input, indexes, excluded),
  };
}

function rankPicks(
  input: RecommendInput,
  indexes: Indexes,
  excluded: Set<string>,
  position: Position,
): RecommendationCandidate[] {
  const rows = indexes.metaByPosition.get(position) ?? [];
  const candidates: RecommendationCandidate[] = [];
  const pool = poolIndex(input.pools, position);
  for (const row of rows) {
    if (row.roleRate < MAJOR_ROLE_RATE || excluded.has(row.championId)) continue;
    const parts: Part[] = [];
    const meta = scorePickMeta(row);
    if (meta) parts.push({ factor: "meta", weight: input.pickWeights.meta, scored: meta });
    const counter = counterScore(input.draft, indexes, row.championId, position);
    if (counter)
      parts.push({ factor: "counter", weight: input.pickWeights.counter, scored: counter });
    const synergy = synergyScore(input.draft, indexes, row.championId, position);
    if (synergy)
      parts.push({ factor: "synergy", weight: input.pickWeights.synergy, scored: synergy });
    const pro = proPickScore(indexes, row.championId, position);
    if (pro) parts.push({ factor: "pro", weight: input.pickWeights.pro, scored: pro });
    if (pool) {
      const scored = scorePool(pool.get(row.championId) ?? null);
      parts.push({ factor: "pool", weight: input.pickWeights.pool, scored });
    }
    const combined = combine(parts, PICK_FACTORS);
    if (!combined) continue;
    candidates.push(toCandidate(row.championId, position, indexes, combined));
  }
  return candidates.sort(byScore).slice(0, input.limit);
}

/** そのロールのプール。1 件も無ければ(未登録・全て除外)計算しないので null */
function poolIndex(
  pools: PoolHints | undefined,
  position: Position,
): Map<string, PoolHintEntry> | null {
  const entries = pools?.[position];
  if (!entries || entries.length === 0) return null;
  return new Map(entries.map((entry) => [entry.championId, entry]));
}

function rankBans(
  input: RecommendInput,
  indexes: Indexes,
  excluded: Set<string>,
): RecommendationCandidate[] {
  const byChampion = new Map<string, MetaStat[]>();
  for (const row of input.snapshot.meta) {
    if (row.roleRate < MAJOR_ROLE_RATE || excluded.has(row.championId)) continue;
    const rows = byChampion.get(row.championId) ?? [];
    rows.push(row);
    byChampion.set(row.championId, rows);
  }

  const candidates: RecommendationCandidate[] = [];
  for (const [championId, rows] of byChampion) {
    const best = bestBanMeta(rows);
    if (!best) continue;
    const parts: Part[] = [{ factor: "meta", weight: input.banWeights.meta, scored: best.scored }];
    const pro = proBanScore(indexes, championId);
    if (pro) parts.push({ factor: "pro", weight: input.banWeights.pro, scored: pro });
    const threat = banThreat(input, indexes, championId);
    if (threat) parts.push({ factor: "counter", weight: input.banWeights.counter, scored: threat });
    const combined = combine(parts, BAN_FACTORS);
    if (!combined) continue;
    candidates.push(toCandidate(championId, best.position, indexes, combined));
  }
  return candidates.sort(byScore).slice(0, input.limit);
}

function proPickScore(indexes: Indexes, championId: string, position: Position): Scored | null {
  const row = indexes.pro.get(metaKey(championId, position));
  if (!row) return null;
  return scoreProPick(row);
}

function proBanScore(indexes: Indexes, championId: string): Scored | null {
  const rows = indexes.proByChampion.get(championId);
  if (!rows || rows.length === 0) return null;
  const games = rows[0]?.games ?? 0;
  if (games <= 0) return null;
  const picks = rows.reduce((sum, row) => sum + row.picks, 0);
  const bans = rows.reduce((max, row) => Math.max(max, row.bans), 0);
  return scoreProBan({
    games,
    picks,
    bans,
    presence: Math.min(1, (picks + bans) / games),
  });
}

function counterScore(
  draft: DraftState,
  indexes: Indexes,
  championId: string,
  position: Position,
): Scored | null {
  const enemySide = opposite(draft.mySide);
  const assigned = draft.assignments[enemySide][position];
  if (assigned) {
    return matchupScore(indexes, championId, position, assigned, false);
  }

  const samples = unassignedPicks(draft, enemySide).flatMap((opponentId) => {
    const roleRate = indexes.meta.get(metaKey(opponentId, position))?.roleRate ?? 0;
    const matchup = indexes.matchups.get(matchupKey(championId, position, opponentId));
    if (roleRate <= 0 || !matchup) return [];
    return [{ ...winSample(matchup, indexes), weight: roleRate }];
  });
  const scored = scoreWinSamples(samples, "pair");
  return scored ? markRoleUncertain(scored) : null;
}

function synergyScore(
  draft: DraftState,
  indexes: Indexes,
  championId: string,
  position: Position,
): Scored | null {
  const allyScores: Scored[] = [];
  for (const allyId of sidePicks(draft, draft.mySide)) {
    if (allyId === championId) continue;
    const allyRole = roleOf(draft, draft.mySide, allyId);
    if (allyRole) {
      const row = indexes.synergies.get(synergyKey(championId, position, allyId, allyRole));
      if (!row) continue;
      const scored = scoreWinSamples([synergySample(row, indexes, allyRole)], "pair");
      if (scored) allyScores.push(scored);
      continue;
    }

    const samples = POSITIONS.flatMap((allyPosition) => {
      const roleRate = indexes.meta.get(metaKey(allyId, allyPosition))?.roleRate ?? 0;
      const row = indexes.synergies.get(synergyKey(championId, position, allyId, allyPosition));
      if (roleRate <= 0 || !row) return [];
      return [{ ...synergySample(row, indexes, allyPosition), weight: roleRate }];
    });
    const scored = scoreWinSamples(samples, "pair");
    if (scored) allyScores.push(markRoleUncertain(scored));
  }
  return averageScores(allyScores);
}

function banThreat(input: RecommendInput, indexes: Indexes, championId: string): Scored | null {
  if (input.preset === "solo") {
    const me = input.draft.me;
    if (!me) return null;
    const mine = input.draft.assignments[me.side][me.position];
    if (!mine) return null;
    return matchupScore(indexes, championId, me.position, mine, true);
  }

  const threats: Scored[] = [];
  for (const allyId of sidePicks(input.draft, input.draft.mySide)) {
    const allyRole = roleOf(input.draft, input.draft.mySide, allyId);
    if (!allyRole) continue;
    const scored = matchupScore(indexes, championId, allyRole, allyId, true);
    if (scored) threats.push(scored);
  }
  return averageScores(threats);
}

function matchupScore(
  indexes: Indexes,
  championId: string,
  position: Position,
  opponentId: string,
  withPosition: boolean,
): Scored | null {
  const matchup = indexes.matchups.get(matchupKey(championId, position, opponentId));
  if (!matchup) return null;
  const sample = winSample(matchup, indexes);
  if (withPosition) {
    sample.reason = `${POSITION_LABELS[position]}で${sample.reason}`;
  }
  return scoreWinSamples([sample], "pair");
}

function bestBanMeta(rows: MetaStat[]): { position: Position; scored: Scored } | null {
  let best: { position: Position; scored: Scored } | null = null;
  for (const row of rows) {
    const scored = scoreBanMeta({ ...row, positionLabel: POSITION_LABELS[row.position] });
    if (!scored) continue;
    if (!best || scored.score > best.scored.score) best = { position: row.position, scored };
  }
  return best;
}

function combine(
  parts: Part[],
  factorOrder: readonly string[],
): { score: number; factors: RecommendationCandidate["factors"]; reasons: string[] } | null {
  const active = parts.filter((part) => part.weight > 0);
  const totalWeight = active.reduce((sum, part) => sum + part.weight, 0);
  const first = active[0];
  if (!first || totalWeight <= 0) return null;

  let score = 0;
  const factors: RecommendationCandidate["factors"] = {};
  const reasons: string[] = [];
  const ordered = [...active].sort(
    (a, b) => factorOrder.indexOf(a.factor) - factorOrder.indexOf(b.factor),
  );
  for (const part of ordered) {
    score += (part.weight / totalWeight) * part.scored.score;
    factors[part.factor] = round4(part.scored.score);
    reasons.push(...part.scored.reasons);
  }
  return { score, factors, reasons };
}

function toCandidate(
  championId: string,
  position: Position,
  indexes: Indexes,
  combined: { score: number; factors: RecommendationCandidate["factors"]; reasons: string[] },
): RecommendationCandidate {
  return {
    championId,
    nameJa: indexes.names.get(championId) ?? championId,
    position,
    score: round4(combined.score),
    factors: combined.factors,
    reasons: combined.reasons,
  };
}

function averageScores(scores: Scored[]): Scored | null {
  const first = scores[0];
  if (!first) return null;
  const reasons = scores.flatMap((scored) =>
    scored.reasons.filter((reason) => reason !== "サンプル不足"),
  );
  if (scores.some((scored) => scored.insufficient)) reasons.push("サンプル不足");
  return {
    score: scores.reduce((sum, scored) => sum + scored.score, 0) / scores.length,
    reasons,
    insufficient: scores.some((scored) => scored.insufficient),
  };
}

function winSample(
  matchup: MatchupStat,
  indexes: Indexes,
): { winRate: number; games: number; weight: number; reason: string } {
  const name = indexes.names.get(matchup.opponentId) ?? matchup.opponentId;
  return {
    winRate: matchup.winRate,
    games: matchup.games,
    weight: 1,
    reason: `対 ${name} 勝率${formatRate(matchup.winRate)}(${formatGames(matchup.games)}試合)`,
  };
}

function synergySample(row: SynergyStat, indexes: Indexes, allyPosition: Position) {
  const name = indexes.names.get(row.allyId) ?? row.allyId;
  return {
    winRate: row.winRate,
    games: row.games,
    weight: 1,
    reason: `${name}(${POSITION_LABELS[allyPosition]})との勝率${formatRate(row.winRate)}(${formatGames(row.games)}試合)`,
  };
}

function buildIndexes(snapshot: StatsSnapshot): Indexes {
  const names = new Map(snapshot.champions.map((champion) => [champion.id, champion.nameJa]));
  const meta = new Map<string, MetaStat>();
  const metaByPosition = new Map<Position, MetaStat[]>();
  for (const row of snapshot.meta) {
    meta.set(metaKey(row.championId, row.position), row);
    const rows = metaByPosition.get(row.position) ?? [];
    rows.push(row);
    metaByPosition.set(row.position, rows);
  }
  const matchups = new Map(
    snapshot.matchups.map((row) => [matchupKey(row.championId, row.position, row.opponentId), row]),
  );
  const synergies = new Map(
    snapshot.synergies.map((row) => [
      synergyKey(row.championId, row.position, row.allyId, row.allyPosition),
      row,
    ]),
  );
  const pro = new Map<string, ProStat>();
  const proByChampion = new Map<string, ProStat[]>();
  for (const row of snapshot.pro) {
    pro.set(metaKey(row.championId, row.position), row);
    const rows = proByChampion.get(row.championId) ?? [];
    rows.push(row);
    proByChampion.set(row.championId, rows);
  }
  return { names, meta, metaByPosition, matchups, synergies, pro, proByChampion };
}

function excludedChampions(draft: DraftState): Set<string> {
  const ids = new Set<string>();
  for (const action of draft.actions) {
    if (action.championId) ids.add(action.championId);
  }
  for (const side of SIDES) {
    for (const position of POSITIONS) {
      const championId = draft.assignments[side][position];
      if (championId) ids.add(championId);
    }
  }
  return ids;
}

function targetPositions(draft: DraftState): Position[] {
  if (draft.me) return [draft.me.position];
  return POSITIONS.filter((position) => draft.assignments[draft.mySide][position] === null);
}

function sidePicks(draft: DraftState, side: Side): string[] {
  const ids = new Set<string>();
  for (const action of draft.actions) {
    if (action.side === side && action.type === "pick" && action.championId)
      ids.add(action.championId);
  }
  for (const position of POSITIONS) {
    const championId = draft.assignments[side][position];
    if (championId) ids.add(championId);
  }
  return [...ids];
}

function unassignedPicks(draft: DraftState, side: Side): string[] {
  return sidePicks(draft, side).filter((championId) => roleOf(draft, side, championId) === null);
}

function roleOf(draft: DraftState, side: Side, championId: string): Position | null {
  for (const position of POSITIONS) {
    if (draft.assignments[side][position] === championId) return position;
  }
  return null;
}

function opposite(side: Side): Side {
  return side === "blue" ? "red" : "blue";
}

function metaKey(championId: string, position: Position): string {
  return `${championId}:${position}`;
}

function matchupKey(championId: string, position: Position, opponentId: string): string {
  return `${championId}:${position}:${opponentId}`;
}

function synergyKey(
  championId: string,
  position: Position,
  allyId: string,
  allyPosition: Position,
): string {
  return `${championId}:${position}:${allyId}:${allyPosition}`;
}

function byScore(a: RecommendationCandidate, b: RecommendationCandidate): number {
  return b.score - a.score || a.championId.localeCompare(b.championId);
}
