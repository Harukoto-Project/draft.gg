//! 画面からのリクエストの扱い。既定値と重みの上書きは、api の `POST /api/recommendations` と同じ。

use draftgg_engine::{
    recommend, recommend_for_request, BanWeights, DraftState, PickWeights, Preset, RecommendInput,
    RecommendationRequest, RequestError, StatsSnapshot,
};
use serde_json::{json, Value};

fn empty_assignment() -> Value {
    json!({"top": null, "jungle": null, "mid": null, "adc": null, "support": null})
}

fn draft(with_me: bool) -> Value {
    let mut draft = json!({
        "format": "ranked",
        "mySide": "blue",
        "actions": [],
        "assignments": {"blue": empty_assignment(), "red": empty_assignment()},
    });
    if with_me {
        draft["me"] = json!({"side": "blue", "position": "mid"});
    }
    draft
}

/// ミッドに 12 体のチャンピオンがいる統計
fn snapshot(tier: &str) -> StatsSnapshot {
    let ids: Vec<String> = (0..12).map(|index| format!("Champ{index:02}")).collect();
    let champions: Vec<Value> = ids
        .iter()
        .enumerate()
        .map(|(index, id)| {
            json!({"id": id, "nameJa": id, "nameEn": id, "numericKey": index + 1, "damageType": "ap"})
        })
        .collect();
    let meta: Vec<Value> = ids
        .iter()
        .enumerate()
        .map(|(index, id)| {
            json!({
                "championId": id, "position": "mid", "games": 10_000,
                "winRate": 0.5 + index as f64 * 0.003, "pickRate": 0.05, "banRate": 0.05,
                "roleRate": 0.8, "tierRank": 3,
            })
        })
        .collect();
    serde_json::from_value(json!({
        "patch": "16.22", "tier": tier, "champions": champions, "meta": meta,
        "matchups": [], "synergies": [], "pro": [],
    }))
    .unwrap()
}

fn request(with_me: bool, extra: Value) -> RecommendationRequest {
    let mut body = json!({ "draft": draft(with_me) });
    for (key, value) in extra.as_object().unwrap() {
        body[key] = value.clone();
    }
    serde_json::from_value(body).unwrap()
}

#[test]
fn 自分の枠があればソロ_なければチームのプリセットにする() {
    let snapshot = snapshot("diamond_plus");
    let solo = recommend_for_request(&snapshot, &request(true, json!({}))).unwrap();
    let team = recommend_for_request(&snapshot, &request(false, json!({}))).unwrap();
    assert_eq!(solo.preset, Preset::Solo);
    assert_eq!(team.preset, Preset::Team);
}

#[test]
fn プリセットを指定すればそちらを使う() {
    let response = recommend_for_request(
        &snapshot("diamond_plus"),
        &request(true, json!({"preset": "team"})),
    )
    .unwrap();
    assert_eq!(response.preset, Preset::Team);
}

#[test]
fn 件数の既定は_8_指定すればその件数にする() {
    let snapshot = snapshot("diamond_plus");
    let default = recommend_for_request(&snapshot, &request(true, json!({}))).unwrap();
    assert_eq!(default.picks[0].candidates.len(), 8);
    assert_eq!(default.bans.len(), 8);

    let three = recommend_for_request(&snapshot, &request(true, json!({"limit": 3}))).unwrap();
    assert_eq!(three.picks[0].candidates.len(), 3);
}

#[test]
fn 件数が_1_から_20_の外ならエラーにする() {
    let snapshot = snapshot("diamond_plus");
    for limit in [0, 21] {
        let result = recommend_for_request(&snapshot, &request(true, json!({"limit": limit})));
        assert_eq!(result.unwrap_err(), RequestError::InvalidLimit);
    }
    assert!(recommend_for_request(&snapshot, &request(true, json!({"limit": 20}))).is_ok());
    assert!(recommend_for_request(&snapshot, &request(true, json!({"limit": 1}))).is_ok());
}

#[test]
fn 重みの上書きは_渡した要素だけプリセットを置き換える() {
    let snapshot = snapshot("diamond_plus");
    let overrides = json!({"weights": {"pick": {"meta": 0.9}, "ban": {"pro": 0.0}}});
    let actual = recommend_for_request(&snapshot, &request(true, overrides)).unwrap();

    let draft: DraftState = serde_json::from_value(draft(true)).unwrap();
    let mut pick_weights = PickWeights::preset(Preset::Solo);
    pick_weights.meta = 0.9;
    let mut ban_weights = BanWeights::preset(Preset::Solo);
    ban_weights.pro = 0.0;
    let expected = recommend(&RecommendInput {
        draft: &draft,
        snapshot: &snapshot,
        preset: Preset::Solo,
        limit: 8,
        pick_weights,
        ban_weights,
        pools: None,
    });
    assert_eq!(actual, expected);
}

#[test]
fn 重みが_0_から_1_の外ならエラーにする() {
    let snapshot = snapshot("diamond_plus");
    for weights in [
        json!({"pick": {"meta": 1.5}}),
        json!({"pick": {"pool": -0.1}}),
        json!({"ban": {"counter": 2}}),
    ] {
        let result = recommend_for_request(&snapshot, &request(true, json!({"weights": weights})));
        assert_eq!(result.unwrap_err(), RequestError::InvalidWeight);
    }
}

#[test]
fn 手元の統計とランク帯が違うなら_メタと対面とシナジーを空にして返す() {
    let response = recommend_for_request(
        &snapshot("diamond_plus"),
        &request(true, json!({"tier": "gold_plus"})),
    )
    .unwrap();
    assert_eq!(response.tier, "gold_plus");
    assert!(response
        .picks
        .iter()
        .all(|group| group.candidates.is_empty()));
    assert!(response.bans.is_empty());
}

#[test]
fn ランク帯を省くと既定の_diamond_plus_を使う() {
    let response =
        recommend_for_request(&snapshot("diamond_plus"), &request(true, json!({}))).unwrap();
    assert_eq!(response.tier, "diamond_plus");
    assert!(!response.picks[0].candidates.is_empty());
}

#[test]
fn 画面が送る_json_を読める() {
    let body = json!({
        "draft": draft(true),
        "pools": {"mid": [{"championId": "Champ01", "games": null, "winRate": null}]},
        "weights": {"pick": {"meta": 0.5}},
    });
    let request: RecommendationRequest = serde_json::from_value(body).unwrap();
    assert!(request.pools.is_some());
    assert_eq!(request.weights.unwrap().pick.unwrap().meta, Some(0.5));
}
