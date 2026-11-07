/** 勝率を全体平均(50%)へ寄せる強さ。メタは試合数が大きいので prior を厚くする。 */
const PRIOR_WIN_RATE = 0.5;
const META_PRIOR_GAMES = 300;
const PAIR_PRIOR_GAMES = 100;

/** 45%で0、55%で1。範囲外は切り詰める。 */
const WIN_SCORE_FLOOR = 0.45;
const WIN_SCORE_SPAN = 0.1;

const META_SAMPLE_MIN_GAMES = 200;
const PAIR_SAMPLE_MIN_GAMES = 50;

const PICK_META_WIN_WEIGHT = 0.7;
const PICK_META_TIER_WEIGHT = 0.3;

const BAN_META_WIN_WEIGHT = 0.5;
const BAN_META_TIER_WEIGHT = 0.3;
const BAN_META_BAN_WEIGHT = 0.2;

const TIER_SCORES: Record<number, number> = { 1: 1, 2: 0.75, 3: 0.5, 4: 0.25, 5: 0 };

export interface Scored {
  score: number;
  reasons: string[];
  insufficient: boolean;
}

export interface WinSample {
  winRate: number;
  games: number;
  weight: number;
  reason: string;
}

export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatGames(games: number): string {
  return Math.round(games)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function bayes(winRate: number, games: number, priorGames: number): number {
  return (winRate * games + PRIOR_WIN_RATE * priorGames) / (games + priorGames);
}

function winScore(smoothedWinRate: number): number {
  return clamp01((smoothedWinRate - WIN_SCORE_FLOOR) / WIN_SCORE_SPAN);
}

export function scoreWinSamples(samples: WinSample[], kind: "meta" | "pair"): Scored | null {
  const usable = samples.filter((sample) => sample.weight > 0);
  const first = usable[0];
  if (!first) return null;

  const priorGames = kind === "meta" ? META_PRIOR_GAMES : PAIR_PRIOR_GAMES;
  const minGames = kind === "meta" ? META_SAMPLE_MIN_GAMES : PAIR_SAMPLE_MIN_GAMES;
  const weightSum = usable.reduce((sum, sample) => sum + sample.weight, 0);
  let score = 0;
  let insufficient = false;
  const reasons = usable.map((sample) => {
    score +=
      (sample.weight / weightSum) * winScore(bayes(sample.winRate, sample.games, priorGames));
    if (sample.games < minGames) insufficient = true;
    return sample.reason;
  });
  if (insufficient) reasons.push("サンプル不足");
  return { score, reasons, insufficient };
}

export function scorePickMeta(input: {
  winRate: number;
  games: number;
  tierRank: number;
}): Scored | null {
  const wins = scoreWinSamples(
    [
      {
        winRate: input.winRate,
        games: input.games,
        weight: 1,
        reason: `勝率${formatRate(input.winRate)}(${formatGames(input.games)}試合)`,
      },
    ],
    "meta",
  );
  if (!wins) return null;

  const tierScore = TIER_SCORES[input.tierRank];
  const score =
    tierScore === undefined
      ? wins.score
      : PICK_META_WIN_WEIGHT * wins.score + PICK_META_TIER_WEIGHT * tierScore;
  const reason = `${wins.reasons[0] ?? ""} ティア${input.tierRank}`;
  const reasons = [reason];
  if (wins.insufficient) reasons.push("サンプル不足");
  return { score, reasons, insufficient: wins.insufficient };
}

export function scoreBanMeta(input: {
  winRate: number;
  games: number;
  tierRank: number;
  banRate: number;
  positionLabel: string;
}): Scored | null {
  const wins = scoreWinSamples(
    [{ winRate: input.winRate, games: input.games, weight: 1, reason: "" }],
    "meta",
  );
  if (!wins) return null;

  const tierScore = TIER_SCORES[input.tierRank];
  const banScore = clamp01(input.banRate);
  const score =
    tierScore === undefined
      ? (BAN_META_WIN_WEIGHT * wins.score + BAN_META_BAN_WEIGHT * banScore) /
        (BAN_META_WIN_WEIGHT + BAN_META_BAN_WEIGHT)
      : BAN_META_WIN_WEIGHT * wins.score +
        BAN_META_TIER_WEIGHT * tierScore +
        BAN_META_BAN_WEIGHT * banScore;
  const reasons = [
    `${input.positionLabel} 勝率${formatRate(input.winRate)}(${formatGames(input.games)}試合) ティア${input.tierRank} BAN率${formatRate(input.banRate)}`,
  ];
  if (wins.insufficient) reasons.push("サンプル不足");
  return { score, reasons, insufficient: wins.insufficient };
}

/** ロールが未確定のときの理由の先頭に、割合で加重したことを添える。 */
export function markRoleUncertain(scored: Scored): Scored {
  const details = scored.reasons.filter((reason) => reason !== "サンプル不足");
  const [first, ...rest] = details;
  if (!first) return scored;
  const reasons = [`ロール未確定のため割合で加重。${first}`, ...rest];
  if (scored.insufficient) reasons.push("サンプル不足");
  return { ...scored, reasons };
}

const POOL_PRIOR_GAMES = 20;
/** この試合数で習熟度が満点 */
const POOL_FULL_GAMES = 30;
const POOL_GAMES_WEIGHT = 0.5;
const POOL_WIN_WEIGHT = 0.5;
/** 手動登録(試合数・勝率なし)のスコア */
const POOL_MANUAL_SCORE = 0.6;

export interface PoolScoreInput {
  games: number | null;
  winRate: number | null;
}

/**
 * プールに入っていれば習熟度(試合数 0.5 + 勝率 0.5)、入っていなければ 0。
 * 手動登録は試合数も勝率も無いので固定値にする。
 */
export function scorePool(entry: PoolScoreInput | null): Scored {
  if (!entry) return { score: 0, reasons: ["プール外"], insufficient: false };
  if (entry.games === null || entry.winRate === null) {
    return { score: POOL_MANUAL_SCORE, reasons: ["プールに登録済み"], insufficient: false };
  }
  const experience = clamp01(entry.games / POOL_FULL_GAMES);
  const wins = winScore(bayes(entry.winRate, entry.games, POOL_PRIOR_GAMES));
  return {
    score: POOL_GAMES_WEIGHT * experience + POOL_WIN_WEIGHT * wins,
    reasons: [`プール 勝率${formatRate(entry.winRate)}(${formatGames(entry.games)}試合)`],
    insufficient: false,
  };
}

const PRO_PRIOR_GAMES = 30;
const PRO_MIN_PICKS = 15;
const PRO_PRESENCE_WEIGHT = 0.6;
const PRO_WIN_WEIGHT = 0.4;

export interface ProScoreInput {
  presence: number;
  picks: number;
  bans: number;
  games: number;
  winRate?: number | null;
}

/** ピックのプロはプレゼンス 0.6 + 勝率 0.4。ピック 15 未満はサンプル不足 */
export function scoreProPick(input: ProScoreInput): Scored | null {
  if (input.games <= 0) return null;
  const presenceScore = clamp01(input.presence);
  const detail = proDetail(input);
  if (input.picks <= 0 || input.winRate === null || input.winRate === undefined) {
    return { score: presenceScore, reasons: [detail, "サンプル不足"], insufficient: true };
  }
  const smoothed =
    (input.winRate * input.picks + PRIOR_WIN_RATE * PRO_PRIOR_GAMES) /
    (input.picks + PRO_PRIOR_GAMES);
  const score = PRO_PRESENCE_WEIGHT * presenceScore + PRO_WIN_WEIGHT * winScore(smoothed);
  const reasons = [`${detail} 勝率${formatRate(input.winRate)}`];
  const insufficient = input.picks < PRO_MIN_PICKS;
  if (insufficient) reasons.push("サンプル不足");
  return { score, reasons, insufficient };
}

/** BAN のプロはプレゼンスだけ。ロールをまたいだピック数と BAN 数で渡す */
export function scoreProBan(input: ProScoreInput): Scored | null {
  if (input.games <= 0) return null;
  return {
    score: clamp01(input.presence),
    reasons: [proDetail(input)],
    insufficient: false,
  };
}

function proDetail(input: ProScoreInput): string {
  return `プロ プレゼンス${formatRate(input.presence)}(ピック${formatGames(input.picks)}・BAN${formatGames(input.bans)} / ${formatGames(input.games)}試合)`;
}
