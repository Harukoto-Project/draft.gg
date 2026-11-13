//! 要素の重み。データが無い要素は計算時に外し、残りの重みを合計 1 にする。

use serde::{Deserialize, Serialize};

use crate::model::Preset;

/// ピックの要素。プールはプールが渡されたロール、構成は味方のピックがあるとき、プロは pro 統計があるとき計算する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Factor {
    Meta,
    Counter,
    Synergy,
    Pro,
    Pool,
    Composition,
}

/// 結果の並び(要素の表示順)。TS の `PICK_FACTORS`
pub const PICK_FACTORS: [Factor; 6] = [
    Factor::Meta,
    Factor::Counter,
    Factor::Synergy,
    Factor::Pro,
    Factor::Pool,
    Factor::Composition,
];

/// TS の `BAN_FACTORS`。カウンターは自分側のピックへの脅威
pub const BAN_FACTORS: [Factor; 3] = [Factor::Meta, Factor::Pro, Factor::Counter];

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickWeights {
    pub meta: f64,
    pub counter: f64,
    pub synergy: f64,
    pub pro: f64,
    pub pool: f64,
    pub composition: f64,
}

impl PickWeights {
    pub fn preset(preset: Preset) -> Self {
        match preset {
            Preset::Solo => PickWeights {
                meta: 0.3,
                counter: 0.3,
                synergy: 0.1,
                pro: 0.05,
                pool: 0.2,
                composition: 0.05,
            },
            Preset::Team => PickWeights {
                meta: 0.1,
                counter: 0.1,
                synergy: 0.25,
                pro: 0.25,
                pool: 0.05,
                composition: 0.25,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BanWeights {
    pub meta: f64,
    pub pro: f64,
    pub counter: f64,
}

impl BanWeights {
    pub fn preset(preset: Preset) -> Self {
        match preset {
            Preset::Solo => BanWeights {
                meta: 0.45,
                pro: 0.1,
                counter: 0.45,
            },
            Preset::Team => BanWeights {
                meta: 0.3,
                pro: 0.35,
                counter: 0.35,
            },
        }
    }
}
