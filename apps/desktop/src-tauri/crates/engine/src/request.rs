//! 画面からの提案リクエストを、`recommend` の入力に直す。
//! 既定値(プリセット・ランク帯・件数)と重みの上書きは、api の `POST /api/recommendations` と同じ規則。

use serde::Deserialize;

use crate::model::{DraftState, PoolHints, Preset, RecommendationResponse, StatsSnapshot};
use crate::recommend::{recommend, RecommendInput};
use crate::weights::{BanWeights, PickWeights};

pub const DEFAULT_RANK_TIER: &str = "diamond_plus";
pub const DEFAULT_RECOMMENDATION_LIMIT: usize = 8;
pub const MAX_RECOMMENDATION_LIMIT: usize = 20;

/// ピックの重みの上書き。渡した要素だけプリセットを置き換える
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub struct PickWeightOverrides {
    pub meta: Option<f64>,
    pub counter: Option<f64>,
    pub synergy: Option<f64>,
    pub pro: Option<f64>,
    pub pool: Option<f64>,
    pub composition: Option<f64>,
}

/// BAN の重みの上書き
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub struct BanWeightOverrides {
    pub meta: Option<f64>,
    pub pro: Option<f64>,
    pub counter: Option<f64>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub struct WeightOverrides {
    pub pick: Option<PickWeightOverrides>,
    pub ban: Option<BanWeightOverrides>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationRequest {
    pub draft: DraftState,
    /// 渡したロールだけ、プールの要素を計算する
    #[serde(default)]
    pub pools: Option<PoolHints>,
    #[serde(default)]
    pub preset: Option<Preset>,
    #[serde(default)]
    pub tier: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub weights: Option<WeightOverrides>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RequestError {
    /// 件数が 1〜20 の範囲外
    InvalidLimit,
    /// 重みが 0〜1 の範囲外(NaN を含む)
    InvalidWeight,
}

impl std::fmt::Display for RequestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RequestError::InvalidLimit => write!(f, "invalid_limit"),
            RequestError::InvalidWeight => write!(f, "invalid_weight"),
        }
    }
}

impl std::error::Error for RequestError {}

pub fn recommend_for_request(
    snapshot: &StatsSnapshot,
    request: &RecommendationRequest,
) -> Result<RecommendationResponse, RequestError> {
    let limit = request.limit.unwrap_or(DEFAULT_RECOMMENDATION_LIMIT);
    if !(1..=MAX_RECOMMENDATION_LIMIT).contains(&limit) {
        return Err(RequestError::InvalidLimit);
    }

    let preset = request.preset.unwrap_or(if request.draft.me.is_some() {
        Preset::Solo
    } else {
        Preset::Team
    });
    let (pick_weights, ban_weights) = merge_weights(preset, request.weights.as_ref())?;

    let tier = request.tier.as_deref().unwrap_or(DEFAULT_RANK_TIER);
    // 手元の統計と違うランク帯を求められたら、メタ・対面・シナジーは無いものとして返す
    let mismatched;
    let usable = if snapshot.tier == tier {
        snapshot
    } else {
        mismatched = StatsSnapshot {
            tier: tier.to_string(),
            meta: Vec::new(),
            matchups: Vec::new(),
            synergies: Vec::new(),
            ..snapshot.clone()
        };
        &mismatched
    };

    Ok(recommend(&RecommendInput {
        draft: &request.draft,
        snapshot: usable,
        preset,
        limit,
        pick_weights,
        ban_weights,
        pools: request.pools.as_ref(),
    }))
}

fn merge_weights(
    preset: Preset,
    overrides: Option<&WeightOverrides>,
) -> Result<(PickWeights, BanWeights), RequestError> {
    let mut pick = PickWeights::preset(preset);
    let mut ban = BanWeights::preset(preset);

    if let Some(over) = overrides.and_then(|weights| weights.pick.as_ref()) {
        apply(&mut pick.meta, over.meta)?;
        apply(&mut pick.counter, over.counter)?;
        apply(&mut pick.synergy, over.synergy)?;
        apply(&mut pick.pro, over.pro)?;
        apply(&mut pick.pool, over.pool)?;
        apply(&mut pick.composition, over.composition)?;
    }
    if let Some(over) = overrides.and_then(|weights| weights.ban.as_ref()) {
        apply(&mut ban.meta, over.meta)?;
        apply(&mut ban.pro, over.pro)?;
        apply(&mut ban.counter, over.counter)?;
    }
    Ok((pick, ban))
}

/// 重みは 0〜1。上限が無いと、巨大な値の合計が Infinity になりスコアが NaN になる
fn apply(target: &mut f64, value: Option<f64>) -> Result<(), RequestError> {
    if let Some(value) = value {
        if !(0.0..=1.0).contains(&value) {
            return Err(RequestError::InvalidWeight);
        }
        *target = value;
    }
    Ok(())
}
