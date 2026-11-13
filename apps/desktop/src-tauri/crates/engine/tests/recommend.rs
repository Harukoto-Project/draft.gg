//! TS 版 `recommend.test.ts` を移したもの。数値と文言は TS 版のテストと同じ。

use draftgg_engine::{
    recommend, BanWeights, DraftState, PickWeights, PoolHints, Preset, RecommendInput,
    RecommendationCandidate, RecommendationResponse, StatsSnapshot,
};
use serde_json::{json, Value};

fn champion(id: &str, name_ja: &str, name_en: &str, key: u32, damage: &str) -> Value {
    json!({"id": id, "nameJa": name_ja, "nameEn": name_en, "numericKey": key, "damageType": damage})
}

fn with_tags(mut champion: Value, tags: &[&str]) -> Value {
    champion["tags"] = json!(tags);
    champion
}

fn ahri() -> Value {
    champion("Ahri", "アーリ", "Ahri", 103, "ap")
}
fn veigar() -> Value {
    champion("Veigar", "ベイガー", "Veigar", 45, "ap")
}
fn zed() -> Value {
    champion("Zed", "ゼド", "Zed", 238, "ad")
}
fn lee() -> Value {
    champion("LeeSin", "リー・シン", "Lee Sin", 64, "ad")
}
fn yasuo() -> Value {
    champion("Yasuo", "ヤスオ", "Yasuo", 157, "ad")
}

fn empty_assignment() -> Value {
    json!({"top": null, "jungle": null, "mid": null, "adc": null, "support": null})
}

fn create_draft() -> Value {
    json!({
        "format": "ranked",
        "mySide": "blue",
        "actions": [],
        "assignments": {"blue": empty_assignment(), "red": empty_assignment()},
        "me": {"side": "blue", "position": "mid"},
    })
}

fn meta_row(champion_id: &str, position: &str, overrides: Value) -> Value {
    let mut row = json!({
        "championId": champion_id,
        "position": position,
        "games": 10_000,
        "winRate": 0.5,
        "pickRate": 0.05,
        "banRate": 0.05,
        "roleRate": 0.8,
        "tierRank": 3,
    });
    merge(&mut row, overrides);
    row
}

fn pro_row(
    champion_id: &str,
    position: &str,
    games: u32,
    picks: u32,
    bans: u32,
    presence: f64,
    win_rate: f64,
) -> Value {
    json!({
        "championId": champion_id, "position": position, "games": games, "picks": picks,
        "bans": bans, "presence": presence, "winRate": win_rate, "earlyPickRate": null,
    })
}

fn merge(target: &mut Value, overrides: Value) {
    if let (Some(target), Value::Object(overrides)) = (target.as_object_mut(), overrides) {
        for (key, value) in overrides {
            target.insert(key, value);
        }
    }
}

struct Case {
    draft: DraftState,
    snapshot: StatsSnapshot,
    preset: Preset,
    pick_weights: PickWeights,
    ban_weights: BanWeights,
    pools: Option<PoolHints>,
}

fn create_case(snapshot: Value, draft: Value) -> Case {
    let mut base = json!({
        "patch": "16.22",
        "tier": "diamond_plus",
        "champions": [ahri(), veigar(), zed(), lee(), yasuo()],
        "meta": [], "matchups": [], "synergies": [], "pro": [],
    });
    merge(&mut base, snapshot);
    Case {
        draft: serde_json::from_value(draft).expect("draft"),
        snapshot: serde_json::from_value(base).expect("snapshot"),
        preset: Preset::Solo,
        pick_weights: PickWeights::preset(Preset::Solo),
        ban_weights: BanWeights::preset(Preset::Solo),
        pools: None,
    }
}

fn run(case: &Case) -> RecommendationResponse {
    recommend(&RecommendInput {
        draft: &case.draft,
        snapshot: &case.snapshot,
        preset: case.preset,
        limit: 8,
        pick_weights: case.pick_weights,
        ban_weights: case.ban_weights,
        pools: case.pools.as_ref(),
    })
}

fn ids(candidates: &[RecommendationCandidate]) -> Vec<&str> {
    candidates.iter().map(|c| c.champion_id.as_str()).collect()
}

fn has_reason(candidate: &RecommendationCandidate, reason: &str) -> bool {
    candidate.reasons.iter().any(|r| r == reason)
}

#[test]
fn メタの勝率とティアが高いチャンピオンを上にし_スコアと理由を返す() {
    let case = create_case(
        json!({"meta": [
            meta_row("Ahri", "mid", json!({"winRate": 0.55, "tierRank": 1})),
            meta_row("Veigar", "mid", json!({"winRate": 0.48, "tierRank": 5})),
        ]}),
        create_draft(),
    );
    let result = run(&case);

    let candidates = &result.picks[0].candidates;
    assert_eq!(ids(candidates), ["Ahri", "Veigar"]);
    // ベイズ平均 (0.55*10000 + 0.5*300) / 10300 を 45%→0、55%→1 にし、勝率0.7 + ティア1の0.3
    assert_eq!(candidates[0].score, 0.9898);
    assert_eq!(candidates[0].factors.meta, Some(0.9898));
    assert_eq!(candidates[0].reasons, ["勝率55.0%(10,000試合) ティア1"]);
    assert_eq!(candidates[1].score, 0.2141);
    assert_eq!(result.patch.as_deref(), Some("16.22"));
    assert_eq!(result.tier, "diamond_plus");
    assert_eq!(result.preset, Preset::Solo);
}

#[test]
fn 対面相手が決まっているときは_その勝率が高い候補を上にする() {
    let mut draft = create_draft();
    draft["assignments"]["red"]["mid"] = json!("Zed");
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({})), meta_row("Veigar", "mid", json!({}))],
            "matchups": [
                {"championId": "Ahri", "position": "mid", "opponentId": "Zed", "games": 1000, "winRate": 0.6},
                {"championId": "Veigar", "position": "mid", "opponentId": "Zed", "games": 1000, "winRate": 0.42},
            ],
        }),
        draft,
    );
    let result = run(&case);

    let candidates = &result.picks[0].candidates;
    assert_eq!(ids(candidates), ["Ahri", "Veigar"]);
    assert!(has_reason(&candidates[0], "対 ゼド 勝率60.0%(1,000試合)"));
}

#[test]
fn 味方のロールが決まっているときは_そのシナジーを理由に出す() {
    let mut draft = create_draft();
    draft["assignments"]["blue"]["jungle"] = json!("LeeSin");
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({})), meta_row("Veigar", "mid", json!({}))],
            "synergies": [{
                "championId": "Ahri", "position": "mid", "allyId": "LeeSin",
                "allyPosition": "jungle", "games": 800, "winRate": 0.58, "score": 1,
            }],
        }),
        draft,
    );
    let result = run(&case);

    assert_eq!(result.picks[0].candidates[0].champion_id, "Ahri");
    assert!(has_reason(
        &result.picks[0].candidates[0],
        "リー・シン(ジャングル)との勝率58.0%(800試合)"
    ));
}

#[test]
fn ban済み_ピック済みのチャンピオンは候補から除く() {
    let mut draft = create_draft();
    draft["actions"] = json!([
        {"step": 0, "type": "ban", "side": "blue", "championId": "Ahri"},
        {"step": 1, "type": "pick", "side": "red", "championId": "Veigar"},
    ]);
    let case = create_case(
        json!({"meta": [
            meta_row("Ahri", "mid", json!({"winRate": 0.6, "tierRank": 1})),
            meta_row("Veigar", "mid", json!({"winRate": 0.6, "tierRank": 1})),
            meta_row("Zed", "mid", json!({"winRate": 0.5, "tierRank": 3})),
        ]}),
        draft,
    );
    let result = run(&case);

    assert_eq!(ids(&result.picks[0].candidates), ["Zed"]);
    assert_eq!(ids(&result.bans), ["Zed"]);
}

#[test]
fn 試合数が閾値未満の対面は_スコアを残したままサンプル不足と出す() {
    let mut draft = create_draft();
    draft["assignments"]["red"]["mid"] = json!("Zed");
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({"games": 100}))],
            "matchups": [{"championId": "Ahri", "position": "mid", "opponentId": "Zed", "games": 40, "winRate": 0.8}],
        }),
        draft,
    );
    let result = run(&case);

    let candidate = &result.picks[0].candidates[0];
    assert_eq!(
        candidate
            .reasons
            .iter()
            .filter(|r| *r == "サンプル不足")
            .count(),
        2
    );
    assert!(candidate.score > 0.0);
}

#[test]
fn 相手のロールが未確定のときは_ロール割合で対面を加重する() {
    let mut draft = create_draft();
    draft["actions"] = json!([{"step": 0, "type": "pick", "side": "red", "championId": "Yasuo"}]);
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({})), meta_row("Yasuo", "mid", json!({"roleRate": 0.6}))],
            "matchups": [{"championId": "Ahri", "position": "mid", "opponentId": "Yasuo", "games": 500, "winRate": 0.56}],
        }),
        draft,
    );
    let result = run(&case);

    assert!(result.picks[0].candidates[0]
        .reasons
        .join(" ")
        .contains("ロール未確定のため割合で加重。対 ヤスオ 勝率56.0%(500試合)"));
}

#[test]
fn 主要ロール未満のチャンピオンは候補にしない() {
    let case = create_case(
        json!({"meta": [meta_row("Ahri", "mid", json!({"roleRate": 0.09, "winRate": 0.6, "tierRank": 1}))]}),
        create_draft(),
    );
    let result = run(&case);

    assert!(result.picks[0].candidates.is_empty());
    assert!(result.bans.is_empty());
}

#[test]
fn ソロのbanは_自分のピックに強いチャンピオンを上にする() {
    let mut draft = create_draft();
    draft["assignments"]["blue"]["mid"] = json!("Ahri");
    let case = create_case(
        json!({
            "meta": [meta_row("Zed", "mid", json!({})), meta_row("Veigar", "mid", json!({})), meta_row("Ahri", "mid", json!({}))],
            "matchups": [
                {"championId": "Zed", "position": "mid", "opponentId": "Ahri", "games": 1000, "winRate": 0.62},
                {"championId": "Veigar", "position": "mid", "opponentId": "Ahri", "games": 1000, "winRate": 0.4},
            ],
        }),
        draft,
    );
    let result = run(&case);

    assert_eq!(&ids(&result.bans)[..2], ["Zed", "Veigar"]);
    assert!(has_reason(
        &result.bans[0],
        "ミッドで対 アーリ 勝率62.0%(1,000試合)"
    ));
    assert!(!ids(&result.bans).contains(&"Ahri"));
}

#[test]
fn プロの重みを変えても_データが無いのでスコアは変わらない() {
    let base = create_case(
        json!({"meta": [meta_row("Ahri", "mid", json!({"winRate": 0.55, "tierRank": 1}))]}),
        create_draft(),
    );
    let mut changed = create_case(
        json!({"meta": [meta_row("Ahri", "mid", json!({"winRate": 0.55, "tierRank": 1}))]}),
        create_draft(),
    );
    changed.pick_weights.pro = 0.9;

    assert_eq!(
        run(&changed).picks[0].candidates[0].score,
        run(&base).picks[0].candidates[0].score
    );
}

#[test]
fn チームで自分の枠が無いときは_空いているロールごとに候補を返す() {
    let mut draft = create_draft();
    draft.as_object_mut().unwrap().remove("me");
    let mut case = create_case(json!({"meta": [meta_row("Ahri", "mid", json!({}))]}), draft);
    case.preset = Preset::Team;
    case.pick_weights = PickWeights::preset(Preset::Team);
    case.ban_weights = BanWeights::preset(Preset::Team);
    let result = run(&case);

    assert_eq!(result.preset, Preset::Team);
    let positions: Vec<String> = result
        .picks
        .iter()
        .map(|group| {
            serde_json::to_value(group.position)
                .unwrap()
                .as_str()
                .unwrap()
                .to_string()
        })
        .collect();
    assert_eq!(positions, ["top", "jungle", "mid", "adc", "support"]);
    let mid = result
        .picks
        .iter()
        .find(|group| serde_json::to_value(group.position).unwrap() == "mid")
        .unwrap();
    assert_eq!(mid.candidates[0].champion_id, "Ahri");
}

#[test]
fn プロのプレゼンスと勝率が高いチャンピオンを上にし_理由にプロを出す() {
    let case = create_case(
        json!({
            "meta": [
                meta_row("Ahri", "mid", json!({"winRate": 0.5, "tierRank": 3})),
                meta_row("Veigar", "mid", json!({"winRate": 0.5, "tierRank": 3})),
            ],
            "pro": [pro_row("Ahri", "mid", 100, 40, 30, 0.7, 0.6)],
        }),
        create_draft(),
    );
    let result = run(&case);

    let candidates = &result.picks[0].candidates;
    assert_eq!(&ids(candidates)[..2], ["Ahri", "Veigar"]);
    assert!(candidates[0].factors.pro.unwrap() > 0.0);
    assert!(candidates[0]
        .reasons
        .iter()
        .any(|r| r.starts_with("プロ プレゼンス")));
    assert!(!has_reason(&candidates[0], "サンプル不足"));
    assert_eq!(candidates[1].factors.pro, None);
}

#[test]
fn プロのピックが_15_未満ならサンプル不足と出す() {
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({}))],
            "pro": [pro_row("Ahri", "mid", 40, 5, 2, 0.175, 0.8)],
        }),
        create_draft(),
    );
    let result = run(&case);

    assert!(has_reason(&result.picks[0].candidates[0], "サンプル不足"));
}

#[test]
fn banのプロはロールをまたいだピック数とban数でプレゼンスを出す() {
    let case = create_case(
        json!({
            "meta": [meta_row("Ahri", "mid", json!({})), meta_row("Veigar", "mid", json!({}))],
            "pro": [
                pro_row("Ahri", "mid", 100, 10, 40, 0.5, 0.5),
                pro_row("Ahri", "support", 100, 5, 40, 0.45, 0.4),
            ],
        }),
        create_draft(),
    );
    let result = run(&case);

    let ahri = result
        .bans
        .iter()
        .find(|c| c.champion_id == "Ahri")
        .unwrap();
    assert!(has_reason(
        ahri,
        "プロ プレゼンス55.0%(ピック15・BAN40 / 100試合)"
    ));
}

#[test]
fn プールが渡されたロールは_プールの習熟度でピック候補を並べ替える() {
    let mut case = create_case(
        json!({"meta": [
            meta_row("Ahri", "mid", json!({})),
            meta_row("Veigar", "mid", json!({})),
            meta_row("Zed", "mid", json!({})),
        ]}),
        create_draft(),
    );
    case.pools = Some(
        serde_json::from_value(json!({"mid": [
            {"championId": "Veigar", "games": 60, "winRate": 0.6},
            {"championId": "Zed", "games": null, "winRate": null},
        ]}))
        .unwrap(),
    );
    let result = run(&case);

    let candidates = &result.picks[0].candidates;
    assert_eq!(ids(candidates), ["Veigar", "Zed", "Ahri"]);
    assert_eq!(candidates[0].factors.pool, Some(1.0));
    assert!(has_reason(&candidates[0], "プール 勝率60.0%(60試合)"));
    assert_eq!(candidates[1].factors.pool, Some(0.6));
    assert!(has_reason(&candidates[1], "プールに登録済み"));
    assert_eq!(candidates[2].factors.pool, Some(0.0));
    assert!(has_reason(&candidates[2], "プール外"));
}

#[test]
fn プールが無い_空のロールでは_プールの要素を計算しない() {
    let pools = [
        None,
        Some(json!({})),
        Some(json!({"mid": []})),
        Some(json!({"top": [{"championId": "Ahri", "games": 1, "winRate": 1}]})),
    ];
    for hint in pools {
        let mut case = create_case(
            json!({"meta": [meta_row("Ahri", "mid", json!({}))]}),
            create_draft(),
        );
        case.pools = hint.map(|value| serde_json::from_value(value).unwrap());
        let result = run(&case);
        assert_eq!(result.picks[0].candidates[0].factors.pool, None);
    }
}

#[test]
fn 試合数が少ないプールは習熟度が低い() {
    let mut case = create_case(
        json!({"meta": [meta_row("Ahri", "mid", json!({}))]}),
        create_draft(),
    );
    case.pools = Some(
        serde_json::from_value(
            json!({"mid": [{"championId": "Ahri", "games": 3, "winRate": 0.5}]}),
        )
        .unwrap(),
    );
    let result = run(&case);

    // 習熟度 3/30 = 0.1 を 0.5、勝率(ベイズ平均 0.5 → 0.5)を 0.5 で重み付け
    assert_eq!(result.picks[0].candidates[0].factors.pool, Some(0.3));
}

#[test]
fn 味方のピックがあるときは_構成バランスで候補を並べ替える() {
    let mut draft = create_draft();
    draft["actions"] = json!([{"step": 0, "type": "pick", "side": "blue", "championId": "Zed"}]);
    draft["assignments"]["blue"]["jungle"] = json!("Zed");
    let case = create_case(
        json!({
            "champions": [
                with_tags(zed(), &["Assassin"]),
                with_tags(ahri(), &["Mage"]),
                with_tags(yasuo(), &["Fighter"]),
            ],
            "meta": [meta_row("Ahri", "mid", json!({})), meta_row("Yasuo", "mid", json!({}))],
        }),
        draft,
    );
    let result = run(&case);

    let candidates = &result.picks[0].candidates;
    // 味方は AD のみ。AP のアーリを足すほうが構成を補える
    assert_eq!(ids(candidates), ["Ahri", "Yasuo"]);
    assert!(
        candidates[0].factors.composition.unwrap()
            > candidates[1].factors.composition.unwrap_or(1.0)
    );
    assert!(has_reason(
        &candidates[0],
        "味方はAD寄りのため、APを足して物理・魔法のバランスを補える"
    ));
}

#[test]
fn 味方のピックが無いときは_構成の要素を計算しない() {
    let case = create_case(
        json!({
            "champions": [with_tags(ahri(), &["Mage"])],
            "meta": [meta_row("Ahri", "mid", json!({}))],
        }),
        create_draft(),
    );
    let result = run(&case);

    assert_eq!(result.picks[0].candidates[0].factors.composition, None);
}

#[test]
fn 同点のときはチャンピオン_id_の順に並べる() {
    // 全員が同じ統計。大文字小文字を区別せず辞書順(KSante は Kaisa のあと)
    let case = create_case(
        json!({
            "champions": [
                champion("KSante", "ケイサンテ", "K'Sante", 1, "ad"),
                champion("Kaisa", "カイサ", "Kai'Sa", 2, "ad"),
                champion("Kalista", "カリスタ", "Kalista", 3, "ad"),
            ],
            "meta": [
                meta_row("KSante", "mid", json!({})),
                meta_row("Kaisa", "mid", json!({})),
                meta_row("Kalista", "mid", json!({})),
            ],
        }),
        create_draft(),
    );
    let result = run(&case);

    assert_eq!(
        ids(&result.picks[0].candidates),
        ["Kaisa", "Kalista", "KSante"]
    );
}
