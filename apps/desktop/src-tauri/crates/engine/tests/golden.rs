//! TS 版 engine(`packages/engine`)が出力した入力と結果(`tests/golden/recommend.json`)を、
//! Rust 版が同じ数値・同じ文言・同じ並びで返すことを確かめる。
//! golden は TS 側のテスト(`UPDATE_GOLDEN=1 pnpm --filter @draftgg/engine test`)で作る。TS 版を削除した後は、このファイルが仕様の固定になる。

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use draftgg_engine::{
    recommend, BanWeights, DraftState, PickWeights, PoolHints, Preset, RecommendInput,
    RecommendationResponse, StatsSnapshot,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct GoldenFile {
    snapshots: HashMap<String, StatsSnapshot>,
    scenarios: Vec<Scenario>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Scenario {
    name: String,
    snapshot: String,
    draft: DraftState,
    preset: Preset,
    limit: usize,
    pick_weights: PickWeights,
    ban_weights: BanWeights,
    pools: Option<PoolHints>,
    expected: RecommendationResponse,
}

fn load() -> GoldenFile {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/golden/recommend.json");
    let text = fs::read_to_string(&path).expect("golden を読めません。TS 側で作り直してください");
    serde_json::from_str(&text).expect("golden の形が想定と違います")
}

#[test]
fn ts_版と同じ結果を返す() {
    let golden = load();
    assert!(
        golden.scenarios.len() >= 150,
        "シナリオが少なすぎます: {}",
        golden.scenarios.len()
    );

    let mut failures = Vec::new();
    for scenario in &golden.scenarios {
        let snapshot = golden
            .snapshots
            .get(&scenario.snapshot)
            .unwrap_or_else(|| panic!("統計 {} がありません", scenario.snapshot));
        let actual = recommend(&RecommendInput {
            draft: &scenario.draft,
            snapshot,
            preset: scenario.preset,
            limit: scenario.limit,
            pick_weights: scenario.pick_weights,
            ban_weights: scenario.ban_weights,
            pools: scenario.pools.as_ref(),
        });
        if actual != scenario.expected {
            failures.push(describe_diff(&scenario.name, &actual, &scenario.expected));
        }
    }

    assert!(
        failures.is_empty(),
        "{} / {} 件が TS 版と違います。先頭の 3 件:\n{}",
        failures.len(),
        golden.scenarios.len(),
        failures
            .iter()
            .take(3)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n---\n")
    );
}

/// 最初に違う候補だけを示す(全体を出すと読めない)
fn describe_diff(
    name: &str,
    actual: &RecommendationResponse,
    expected: &RecommendationResponse,
) -> String {
    if actual.picks.len() != expected.picks.len() {
        return format!(
            "{name}: ロールの数が違う {} / {}",
            actual.picks.len(),
            expected.picks.len()
        );
    }
    for (a, e) in actual.picks.iter().zip(&expected.picks) {
        if a != e {
            return format!(
                "{name}: ピック {:?}\n  実際: {}\n  期待: {}",
                e.position,
                serde_json::to_string(&a.candidates).unwrap(),
                serde_json::to_string(&e.candidates).unwrap()
            );
        }
    }
    format!(
        "{name}: BAN または全体の項目\n  実際: {}\n  期待: {}",
        serde_json::to_string(&actual.bans).unwrap(),
        serde_json::to_string(&expected.bans).unwrap()
    )
}
