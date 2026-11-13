//! ドラフトの状況と統計から、ピック候補とBAN候補を出す。
//! 数値の計算順・丸め・並び・理由文は TS 版(`packages/engine/src/recommend.ts`)にそろえている。

use std::collections::{HashMap, HashSet};

use crate::composition::score_composition;
use crate::format::{compare_ids, format_games, format_rate, round4};
use crate::model::{
    ActionType, ChampionRef, DraftState, Factors, MatchupStat, MetaStat, PickRecommendations,
    PoolHintEntry, PoolHints, Position, Preset, ProStat, RecommendationCandidate,
    RecommendationResponse, Side, StatsSnapshot, SynergyStat,
};
use crate::score::{
    mark_role_uncertain, score_ban_meta, score_pick_meta, score_pool, score_pro_ban,
    score_pro_pick, score_win_samples, BanMetaInput, PickMetaInput, PoolScoreInput, ProScoreInput,
    Scored, WinKind, WinSample,
};
use crate::weights::{BanWeights, Factor, PickWeights, BAN_FACTORS, PICK_FACTORS};

/// 主要ロールとみなす割合。そのチャンピオンの試合のうち、この割合以上を占めるロールだけ候補にする
const MAJOR_ROLE_RATE: f64 = 0.1;

const INSUFFICIENT: &str = "サンプル不足";

pub struct RecommendInput<'a> {
    pub draft: &'a DraftState,
    pub snapshot: &'a StatsSnapshot,
    pub preset: Preset,
    pub limit: usize,
    pub pick_weights: PickWeights,
    pub ban_weights: BanWeights,
    /// ロールごとの担当プレイヤーのプール。渡したロールだけ、プールの要素を計算する。
    pub pools: Option<&'a PoolHints>,
}

struct Indexes<'a> {
    names: HashMap<&'a str, &'a str>,
    refs: HashMap<&'a str, &'a ChampionRef>,
    meta: HashMap<(&'a str, Position), &'a MetaStat>,
    matchups: HashMap<(&'a str, Position, &'a str), &'a MatchupStat>,
    synergies: HashMap<(&'a str, Position, &'a str, Position), &'a SynergyStat>,
    pro: HashMap<(&'a str, Position), &'a ProStat>,
    pro_by_champion: HashMap<&'a str, Vec<&'a ProStat>>,
}

struct Part {
    factor: Factor,
    weight: f64,
    scored: Scored,
}

struct Combined {
    score: f64,
    factors: Factors,
    reasons: Vec<String>,
}

pub fn recommend(input: &RecommendInput) -> RecommendationResponse {
    let indexes = build_indexes(input.snapshot);
    let excluded = excluded_champions(input.draft);
    let picks = target_positions(input.draft)
        .into_iter()
        .map(|position| PickRecommendations {
            position,
            candidates: rank_picks(input, &indexes, &excluded, position),
        })
        .collect();

    RecommendationResponse {
        patch: input.snapshot.patch.clone(),
        tier: input.snapshot.tier.clone(),
        preset: input.preset,
        picks,
        bans: rank_bans(input, &indexes, &excluded),
    }
}

fn rank_picks(
    input: &RecommendInput,
    indexes: &Indexes,
    excluded: &HashSet<&str>,
    position: Position,
) -> Vec<RecommendationCandidate> {
    let mut candidates = Vec::new();
    let pool = pool_index(input.pools, position);
    let allies = ally_refs(input.draft, indexes);

    for row in input
        .snapshot
        .meta
        .iter()
        .filter(|row| row.position == position)
    {
        let champion_id = row.champion_id.as_str();
        if row.role_rate < MAJOR_ROLE_RATE || excluded.contains(champion_id) {
            continue;
        }
        let weights = &input.pick_weights;
        let mut parts = Vec::new();
        if let Some(scored) = score_pick_meta(&PickMetaInput {
            win_rate: row.win_rate,
            games: row.games,
            tier_rank: row.tier_rank,
        }) {
            parts.push(Part {
                factor: Factor::Meta,
                weight: weights.meta,
                scored,
            });
        }
        if let Some(scored) = counter_score(input.draft, indexes, champion_id, position) {
            parts.push(Part {
                factor: Factor::Counter,
                weight: weights.counter,
                scored,
            });
        }
        if let Some(scored) = synergy_score(input.draft, indexes, champion_id, position) {
            parts.push(Part {
                factor: Factor::Synergy,
                weight: weights.synergy,
                scored,
            });
        }
        if let Some(scored) = pro_pick_score(indexes, champion_id, position) {
            parts.push(Part {
                factor: Factor::Pro,
                weight: weights.pro,
                scored,
            });
        }
        if let Some(pool) = &pool {
            let entry = pool.get(champion_id).map(|entry| PoolScoreInput {
                games: entry.games,
                win_rate: entry.win_rate,
            });
            parts.push(Part {
                factor: Factor::Pool,
                weight: weights.pool,
                scored: score_pool(entry.as_ref()),
            });
        }
        if let Some(scored) = score_composition(&allies, indexes.refs.get(champion_id).copied()) {
            parts.push(Part {
                factor: Factor::Composition,
                weight: weights.composition,
                scored,
            });
        }

        let Some(combined) = combine(parts, &PICK_FACTORS) else {
            continue;
        };
        candidates.push(to_candidate(champion_id, position, indexes, combined));
    }
    sort_and_limit(candidates, input.limit)
}

/// 味方のピック(チャンピオンの属性つき)。属性が引けないものは除く
fn ally_refs<'a>(draft: &DraftState, indexes: &Indexes<'a>) -> Vec<&'a ChampionRef> {
    side_picks(draft, draft.my_side)
        .into_iter()
        .filter_map(|id| indexes.refs.get(id).copied())
        .collect()
}

/// そのロールのプール。1 件も無ければ(未登録・全て除外)計算しないので None
fn pool_index(
    pools: Option<&PoolHints>,
    position: Position,
) -> Option<HashMap<&str, &PoolHintEntry>> {
    let entries = pools?.get(&position)?;
    if entries.is_empty() {
        return None;
    }
    Some(
        entries
            .iter()
            .map(|entry| (entry.champion_id.as_str(), entry))
            .collect(),
    )
}

fn rank_bans(
    input: &RecommendInput,
    indexes: &Indexes,
    excluded: &HashSet<&str>,
) -> Vec<RecommendationCandidate> {
    // 出てきた順を保つ(最も強いロールを選ぶとき、同点なら先のほうを残すため)
    let mut order: Vec<&str> = Vec::new();
    let mut by_champion: HashMap<&str, Vec<&MetaStat>> = HashMap::new();
    for row in &input.snapshot.meta {
        let champion_id = row.champion_id.as_str();
        if row.role_rate < MAJOR_ROLE_RATE || excluded.contains(champion_id) {
            continue;
        }
        let rows = by_champion.entry(champion_id).or_default();
        if rows.is_empty() {
            order.push(champion_id);
        }
        rows.push(row);
    }

    let weights = &input.ban_weights;
    let mut candidates = Vec::new();
    for champion_id in order {
        let Some((position, best)) = best_ban_meta(&by_champion[champion_id]) else {
            continue;
        };
        let mut parts = vec![Part {
            factor: Factor::Meta,
            weight: weights.meta,
            scored: best,
        }];
        if let Some(scored) = pro_ban_score(indexes, champion_id) {
            parts.push(Part {
                factor: Factor::Pro,
                weight: weights.pro,
                scored,
            });
        }
        if let Some(scored) = ban_threat(input, indexes, champion_id) {
            parts.push(Part {
                factor: Factor::Counter,
                weight: weights.counter,
                scored,
            });
        }
        let Some(combined) = combine(parts, &BAN_FACTORS) else {
            continue;
        };
        candidates.push(to_candidate(champion_id, position, indexes, combined));
    }
    sort_and_limit(candidates, input.limit)
}

fn pro_pick_score(indexes: &Indexes, champion_id: &str, position: Position) -> Option<Scored> {
    let row = indexes.pro.get(&(champion_id, position))?;
    score_pro_pick(&ProScoreInput {
        presence: row.presence,
        picks: row.picks,
        bans: row.bans,
        games: row.games,
        win_rate: row.win_rate,
    })
}

fn pro_ban_score(indexes: &Indexes, champion_id: &str) -> Option<Scored> {
    let rows = indexes.pro_by_champion.get(champion_id)?;
    let games = rows.first()?.games;
    if games <= 0.0 {
        return None;
    }
    let picks = rows.iter().fold(0.0, |sum, row| sum + row.picks);
    let bans = rows.iter().fold(0.0, |max: f64, row| max.max(row.bans));
    score_pro_ban(&ProScoreInput {
        games,
        picks,
        bans,
        presence: ((picks + bans) / games).min(1.0),
        win_rate: None,
    })
}

fn counter_score(
    draft: &DraftState,
    indexes: &Indexes,
    champion_id: &str,
    position: Position,
) -> Option<Scored> {
    let enemy_side = draft.my_side.opposite();
    if let Some(assigned) = non_empty(draft.assignments.side(enemy_side).get(position)) {
        return matchup_score(indexes, champion_id, position, assigned, false);
    }

    let samples: Vec<WinSample> = unassigned_picks(draft, enemy_side)
        .into_iter()
        .filter_map(|opponent_id| {
            let role_rate = indexes
                .meta
                .get(&(opponent_id, position))
                .map_or(0.0, |row| row.role_rate);
            let matchup = indexes
                .matchups
                .get(&(champion_id, position, opponent_id))?;
            if role_rate <= 0.0 {
                return None;
            }
            Some(WinSample {
                weight: role_rate,
                ..win_sample(matchup, indexes)
            })
        })
        .collect();
    score_win_samples(&samples, WinKind::Pair).map(mark_role_uncertain)
}

fn synergy_score(
    draft: &DraftState,
    indexes: &Indexes,
    champion_id: &str,
    position: Position,
) -> Option<Scored> {
    let mut ally_scores = Vec::new();
    for ally_id in side_picks(draft, draft.my_side) {
        if ally_id == champion_id {
            continue;
        }
        if let Some(ally_role) = role_of(draft, draft.my_side, ally_id) {
            let Some(row) = indexes
                .synergies
                .get(&(champion_id, position, ally_id, ally_role))
            else {
                continue;
            };
            if let Some(scored) =
                score_win_samples(&[synergy_sample(row, indexes, ally_role)], WinKind::Pair)
            {
                ally_scores.push(scored);
            }
            continue;
        }

        let samples: Vec<WinSample> = Position::ALL
            .into_iter()
            .filter_map(|ally_position| {
                let role_rate = indexes
                    .meta
                    .get(&(ally_id, ally_position))
                    .map_or(0.0, |row| row.role_rate);
                let row =
                    indexes
                        .synergies
                        .get(&(champion_id, position, ally_id, ally_position))?;
                if role_rate <= 0.0 {
                    return None;
                }
                Some(WinSample {
                    weight: role_rate,
                    ..synergy_sample(row, indexes, ally_position)
                })
            })
            .collect();
        if let Some(scored) = score_win_samples(&samples, WinKind::Pair) {
            ally_scores.push(mark_role_uncertain(scored));
        }
    }
    average_scores(&ally_scores)
}

fn ban_threat(input: &RecommendInput, indexes: &Indexes, champion_id: &str) -> Option<Scored> {
    let draft = input.draft;
    if input.preset == Preset::Solo {
        let me = draft.me?;
        let mine = non_empty(draft.assignments.side(me.side).get(me.position))?;
        return matchup_score(indexes, champion_id, me.position, mine, true);
    }

    let mut threats = Vec::new();
    for ally_id in side_picks(draft, draft.my_side) {
        let Some(ally_role) = role_of(draft, draft.my_side, ally_id) else {
            continue;
        };
        if let Some(scored) = matchup_score(indexes, champion_id, ally_role, ally_id, true) {
            threats.push(scored);
        }
    }
    average_scores(&threats)
}

fn matchup_score(
    indexes: &Indexes,
    champion_id: &str,
    position: Position,
    opponent_id: &str,
    with_position: bool,
) -> Option<Scored> {
    let matchup = indexes
        .matchups
        .get(&(champion_id, position, opponent_id))?;
    let mut sample = win_sample(matchup, indexes);
    if with_position {
        sample.reason = format!("{}で{}", position.label(), sample.reason);
    }
    score_win_samples(&[sample], WinKind::Pair)
}

fn best_ban_meta(rows: &[&MetaStat]) -> Option<(Position, Scored)> {
    let mut best: Option<(Position, Scored)> = None;
    for row in rows {
        let Some(scored) = score_ban_meta(&BanMetaInput {
            win_rate: row.win_rate,
            games: row.games,
            tier_rank: row.tier_rank,
            ban_rate: row.ban_rate,
            position_label: row.position.label(),
        }) else {
            continue;
        };
        let better = best
            .as_ref()
            .is_none_or(|(_, current)| scored.score > current.score);
        if better {
            best = Some((row.position, scored));
        }
    }
    best
}

fn combine(parts: Vec<Part>, factor_order: &[Factor]) -> Option<Combined> {
    let active: Vec<Part> = parts.into_iter().filter(|part| part.weight > 0.0).collect();
    let total_weight = active.iter().fold(0.0, |sum, part| sum + part.weight);
    if active.is_empty() || total_weight <= 0.0 {
        return None;
    }

    let mut ordered = active;
    // 同じ要素は 1 つだけなので、順序は要素の並びだけで決まる
    ordered.sort_by_key(|part| {
        factor_order
            .iter()
            .position(|factor| *factor == part.factor)
            .unwrap_or(usize::MAX)
    });

    let mut score = 0.0;
    let mut factors = Factors::default();
    let mut reasons = Vec::new();
    for part in ordered {
        score += (part.weight / total_weight) * part.scored.score;
        set_factor(&mut factors, part.factor, round4(part.scored.score));
        reasons.extend(part.scored.reasons);
    }
    Some(Combined {
        score,
        factors,
        reasons,
    })
}

fn set_factor(factors: &mut Factors, factor: Factor, value: f64) {
    let slot = match factor {
        Factor::Meta => &mut factors.meta,
        Factor::Counter => &mut factors.counter,
        Factor::Synergy => &mut factors.synergy,
        Factor::Pro => &mut factors.pro,
        Factor::Pool => &mut factors.pool,
        Factor::Composition => &mut factors.composition,
    };
    *slot = Some(value);
}

fn to_candidate(
    champion_id: &str,
    position: Position,
    indexes: &Indexes,
    combined: Combined,
) -> RecommendationCandidate {
    RecommendationCandidate {
        champion_id: champion_id.to_string(),
        name_ja: indexes
            .names
            .get(champion_id)
            .map_or(champion_id, |name| *name)
            .to_string(),
        position,
        score: round4(combined.score),
        factors: combined.factors,
        reasons: combined.reasons,
    }
}

fn average_scores(scores: &[Scored]) -> Option<Scored> {
    if scores.is_empty() {
        return None;
    }
    let mut reasons: Vec<String> = scores
        .iter()
        .flat_map(|scored| scored.reasons.iter())
        .filter(|reason| reason.as_str() != INSUFFICIENT)
        .cloned()
        .collect();
    let insufficient = scores.iter().any(|scored| scored.insufficient);
    if insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Some(Scored {
        score: scores.iter().fold(0.0, |sum, scored| sum + scored.score) / scores.len() as f64,
        reasons,
        insufficient,
    })
}

fn win_sample(matchup: &MatchupStat, indexes: &Indexes) -> WinSample {
    let name = indexes
        .names
        .get(matchup.opponent_id.as_str())
        .map_or(matchup.opponent_id.as_str(), |name| *name);
    WinSample {
        win_rate: matchup.win_rate,
        games: matchup.games,
        weight: 1.0,
        reason: format!(
            "対 {name} 勝率{}({}試合)",
            format_rate(matchup.win_rate),
            format_games(matchup.games)
        ),
    }
}

fn synergy_sample(row: &SynergyStat, indexes: &Indexes, ally_position: Position) -> WinSample {
    let name = indexes
        .names
        .get(row.ally_id.as_str())
        .map_or(row.ally_id.as_str(), |name| *name);
    WinSample {
        win_rate: row.win_rate,
        games: row.games,
        weight: 1.0,
        reason: format!(
            "{name}({})との勝率{}({}試合)",
            ally_position.label(),
            format_rate(row.win_rate),
            format_games(row.games)
        ),
    }
}

fn build_indexes(snapshot: &StatsSnapshot) -> Indexes<'_> {
    let mut pro_by_champion: HashMap<&str, Vec<&ProStat>> = HashMap::new();
    for row in &snapshot.pro {
        pro_by_champion
            .entry(row.champion_id.as_str())
            .or_default()
            .push(row);
    }
    Indexes {
        names: snapshot
            .champions
            .iter()
            .map(|champion| (champion.id.as_str(), champion.name_ja.as_str()))
            .collect(),
        refs: snapshot
            .champions
            .iter()
            .map(|champion| (champion.id.as_str(), champion))
            .collect(),
        meta: snapshot
            .meta
            .iter()
            .map(|row| ((row.champion_id.as_str(), row.position), row))
            .collect(),
        matchups: snapshot
            .matchups
            .iter()
            .map(|row| {
                (
                    (
                        row.champion_id.as_str(),
                        row.position,
                        row.opponent_id.as_str(),
                    ),
                    row,
                )
            })
            .collect(),
        synergies: snapshot
            .synergies
            .iter()
            .map(|row| {
                (
                    (
                        row.champion_id.as_str(),
                        row.position,
                        row.ally_id.as_str(),
                        row.ally_position,
                    ),
                    row,
                )
            })
            .collect(),
        pro: snapshot
            .pro
            .iter()
            .map(|row| ((row.champion_id.as_str(), row.position), row))
            .collect(),
        pro_by_champion,
    }
}

fn excluded_champions(draft: &DraftState) -> HashSet<&str> {
    let mut ids = HashSet::new();
    for action in &draft.actions {
        if let Some(id) = non_empty(action.champion_id.as_deref()) {
            ids.insert(id);
        }
    }
    for side in Side::ALL {
        for position in Position::ALL {
            if let Some(id) = non_empty(draft.assignments.side(side).get(position)) {
                ids.insert(id);
            }
        }
    }
    ids
}

fn target_positions(draft: &DraftState) -> Vec<Position> {
    if let Some(me) = draft.me {
        return vec![me.position];
    }
    Position::ALL
        .into_iter()
        .filter(|position| {
            draft
                .assignments
                .side(draft.my_side)
                .get(*position)
                .is_none()
        })
        .collect()
}

/// その陣営のピック(ピック手とロール割り当て)。重複は除き、出てきた順を保つ
fn side_picks(draft: &DraftState, side: Side) -> Vec<&str> {
    let mut ids: Vec<&str> = Vec::new();
    for action in &draft.actions {
        if action.side == side && action.kind == ActionType::Pick {
            if let Some(id) = non_empty(action.champion_id.as_deref()) {
                push_unique(&mut ids, id);
            }
        }
    }
    for position in Position::ALL {
        if let Some(id) = non_empty(draft.assignments.side(side).get(position)) {
            push_unique(&mut ids, id);
        }
    }
    ids
}

fn push_unique<'a>(ids: &mut Vec<&'a str>, id: &'a str) {
    if !ids.contains(&id) {
        ids.push(id);
    }
}

fn unassigned_picks(draft: &DraftState, side: Side) -> Vec<&str> {
    side_picks(draft, side)
        .into_iter()
        .filter(|id| role_of(draft, side, id).is_none())
        .collect()
}

fn role_of(draft: &DraftState, side: Side, champion_id: &str) -> Option<Position> {
    Position::ALL
        .into_iter()
        .find(|position| draft.assignments.side(side).get(*position) == Some(champion_id))
}

/// JS の「空文字は偽」にそろえる
fn non_empty(id: Option<&str>) -> Option<&str> {
    id.filter(|id| !id.is_empty())
}

fn sort_and_limit(
    mut candidates: Vec<RecommendationCandidate>,
    limit: usize,
) -> Vec<RecommendationCandidate> {
    candidates.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| compare_ids(&a.champion_id, &b.champion_id))
    });
    candidates.truncate(limit);
    candidates
}
