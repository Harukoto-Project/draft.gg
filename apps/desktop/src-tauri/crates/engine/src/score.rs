//! 要素ごとのスコア(0〜1)と理由。数値・文言は TS 版の `score.ts` と同じ。

use crate::format::{clamp01, format_games, format_number, format_rate};

/// 勝率を全体平均(50%)へ寄せる強さ。メタは試合数が大きいので prior を厚くする。
const PRIOR_WIN_RATE: f64 = 0.5;
const META_PRIOR_GAMES: f64 = 300.0;
const PAIR_PRIOR_GAMES: f64 = 100.0;

/// 45%で0、55%で1。範囲外は切り詰める。
const WIN_SCORE_FLOOR: f64 = 0.45;
const WIN_SCORE_SPAN: f64 = 0.1;

const META_SAMPLE_MIN_GAMES: f64 = 200.0;
const PAIR_SAMPLE_MIN_GAMES: f64 = 50.0;

const PICK_META_WIN_WEIGHT: f64 = 0.7;
const PICK_META_TIER_WEIGHT: f64 = 0.3;

const BAN_META_WIN_WEIGHT: f64 = 0.5;
const BAN_META_TIER_WEIGHT: f64 = 0.3;
const BAN_META_BAN_WEIGHT: f64 = 0.2;

const INSUFFICIENT: &str = "サンプル不足";

/// ティア 1〜5 のスコア。範囲外は None(勝率だけで評価する)
fn tier_score(tier_rank: f64) -> Option<f64> {
    if tier_rank == 1.0 {
        Some(1.0)
    } else if tier_rank == 2.0 {
        Some(0.75)
    } else if tier_rank == 3.0 {
        Some(0.5)
    } else if tier_rank == 4.0 {
        Some(0.25)
    } else if tier_rank == 5.0 {
        Some(0.0)
    } else {
        None
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Scored {
    pub score: f64,
    pub reasons: Vec<String>,
    pub insufficient: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WinSample {
    pub win_rate: f64,
    pub games: f64,
    pub weight: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WinKind {
    /// メタ(試合数が多いので prior を厚くする)
    Meta,
    /// 対面・シナジー
    Pair,
}

fn bayes(win_rate: f64, games: f64, prior_games: f64) -> f64 {
    (win_rate * games + PRIOR_WIN_RATE * prior_games) / (games + prior_games)
}

fn win_score(smoothed_win_rate: f64) -> f64 {
    clamp01((smoothed_win_rate - WIN_SCORE_FLOOR) / WIN_SCORE_SPAN)
}

pub fn score_win_samples(samples: &[WinSample], kind: WinKind) -> Option<Scored> {
    let usable: Vec<&WinSample> = samples
        .iter()
        .filter(|sample| sample.weight > 0.0)
        .collect();
    if usable.is_empty() {
        return None;
    }

    let (prior_games, min_games) = match kind {
        WinKind::Meta => (META_PRIOR_GAMES, META_SAMPLE_MIN_GAMES),
        WinKind::Pair => (PAIR_PRIOR_GAMES, PAIR_SAMPLE_MIN_GAMES),
    };
    let weight_sum = usable.iter().fold(0.0, |sum, sample| sum + sample.weight);
    let mut score = 0.0;
    let mut insufficient = false;
    let mut reasons = Vec::with_capacity(usable.len() + 1);
    for sample in usable {
        score += (sample.weight / weight_sum)
            * win_score(bayes(sample.win_rate, sample.games, prior_games));
        if sample.games < min_games {
            insufficient = true;
        }
        reasons.push(sample.reason.clone());
    }
    if insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Some(Scored {
        score,
        reasons,
        insufficient,
    })
}

pub struct PickMetaInput {
    pub win_rate: f64,
    pub games: f64,
    pub tier_rank: f64,
}

pub fn score_pick_meta(input: &PickMetaInput) -> Option<Scored> {
    let wins = score_win_samples(
        &[WinSample {
            win_rate: input.win_rate,
            games: input.games,
            weight: 1.0,
            reason: format!(
                "勝率{}({}試合)",
                format_rate(input.win_rate),
                format_games(input.games)
            ),
        }],
        WinKind::Meta,
    )?;

    let score = match tier_score(input.tier_rank) {
        None => wins.score,
        Some(tier) => PICK_META_WIN_WEIGHT * wins.score + PICK_META_TIER_WEIGHT * tier,
    };
    let first = wins.reasons.first().map(String::as_str).unwrap_or("");
    let mut reasons = vec![format!("{first} ティア{}", format_number(input.tier_rank))];
    if wins.insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Some(Scored {
        score,
        reasons,
        insufficient: wins.insufficient,
    })
}

pub struct BanMetaInput<'a> {
    pub win_rate: f64,
    pub games: f64,
    pub tier_rank: f64,
    pub ban_rate: f64,
    pub position_label: &'a str,
}

pub fn score_ban_meta(input: &BanMetaInput) -> Option<Scored> {
    let wins = score_win_samples(
        &[WinSample {
            win_rate: input.win_rate,
            games: input.games,
            weight: 1.0,
            reason: String::new(),
        }],
        WinKind::Meta,
    )?;

    let ban_score = clamp01(input.ban_rate);
    let score = match tier_score(input.tier_rank) {
        None => {
            (BAN_META_WIN_WEIGHT * wins.score + BAN_META_BAN_WEIGHT * ban_score)
                / (BAN_META_WIN_WEIGHT + BAN_META_BAN_WEIGHT)
        }
        Some(tier) => {
            BAN_META_WIN_WEIGHT * wins.score
                + BAN_META_TIER_WEIGHT * tier
                + BAN_META_BAN_WEIGHT * ban_score
        }
    };
    let mut reasons = vec![format!(
        "{} 勝率{}({}試合) ティア{} BAN率{}",
        input.position_label,
        format_rate(input.win_rate),
        format_games(input.games),
        format_number(input.tier_rank),
        format_rate(input.ban_rate),
    )];
    if wins.insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Some(Scored {
        score,
        reasons,
        insufficient: wins.insufficient,
    })
}

/// ロールが未確定のときの理由の先頭に、割合で加重したことを添える。
pub fn mark_role_uncertain(scored: Scored) -> Scored {
    let mut details = scored
        .reasons
        .iter()
        .filter(|reason| reason.as_str() != INSUFFICIENT);
    let Some(first) = details.next() else {
        return scored;
    };
    let mut reasons = vec![format!("ロール未確定のため割合で加重。{first}")];
    reasons.extend(details.cloned());
    if scored.insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Scored { reasons, ..scored }
}

const POOL_PRIOR_GAMES: f64 = 20.0;
/// この試合数で習熟度が満点
const POOL_FULL_GAMES: f64 = 30.0;
const POOL_GAMES_WEIGHT: f64 = 0.5;
const POOL_WIN_WEIGHT: f64 = 0.5;
/// 手動登録(試合数・勝率なし)のスコア
const POOL_MANUAL_SCORE: f64 = 0.6;

pub struct PoolScoreInput {
    pub games: Option<f64>,
    pub win_rate: Option<f64>,
}

/// プールに入っていれば習熟度(試合数 0.5 + 勝率 0.5)、入っていなければ 0。
/// 手動登録は試合数も勝率も無いので固定値にする。
pub fn score_pool(entry: Option<&PoolScoreInput>) -> Scored {
    let Some(entry) = entry else {
        return Scored {
            score: 0.0,
            reasons: vec!["プール外".to_string()],
            insufficient: false,
        };
    };
    let (Some(games), Some(win_rate)) = (entry.games, entry.win_rate) else {
        return Scored {
            score: POOL_MANUAL_SCORE,
            reasons: vec!["プールに登録済み".to_string()],
            insufficient: false,
        };
    };
    let experience = clamp01(games / POOL_FULL_GAMES);
    let wins = win_score(bayes(win_rate, games, POOL_PRIOR_GAMES));
    Scored {
        score: POOL_GAMES_WEIGHT * experience + POOL_WIN_WEIGHT * wins,
        reasons: vec![format!(
            "プール 勝率{}({}試合)",
            format_rate(win_rate),
            format_games(games)
        )],
        insufficient: false,
    }
}

const PRO_PRIOR_GAMES: f64 = 30.0;
const PRO_MIN_PICKS: f64 = 15.0;
const PRO_PRESENCE_WEIGHT: f64 = 0.6;
const PRO_WIN_WEIGHT: f64 = 0.4;

pub struct ProScoreInput {
    pub presence: f64,
    pub picks: f64,
    pub bans: f64,
    pub games: f64,
    pub win_rate: Option<f64>,
}

/// ピックのプロはプレゼンス 0.6 + 勝率 0.4。ピック 15 未満はサンプル不足
pub fn score_pro_pick(input: &ProScoreInput) -> Option<Scored> {
    if input.games <= 0.0 {
        return None;
    }
    let presence_score = clamp01(input.presence);
    let detail = pro_detail(input);
    let win_rate = match input.win_rate {
        Some(win_rate) if input.picks > 0.0 => win_rate,
        _ => {
            return Some(Scored {
                score: presence_score,
                reasons: vec![detail, INSUFFICIENT.to_string()],
                insufficient: true,
            });
        }
    };
    let smoothed = (win_rate * input.picks + PRIOR_WIN_RATE * PRO_PRIOR_GAMES)
        / (input.picks + PRO_PRIOR_GAMES);
    let score = PRO_PRESENCE_WEIGHT * presence_score + PRO_WIN_WEIGHT * win_score(smoothed);
    let mut reasons = vec![format!("{detail} 勝率{}", format_rate(win_rate))];
    let insufficient = input.picks < PRO_MIN_PICKS;
    if insufficient {
        reasons.push(INSUFFICIENT.to_string());
    }
    Some(Scored {
        score,
        reasons,
        insufficient,
    })
}

/// BAN のプロはプレゼンスだけ。ロールをまたいだピック数と BAN 数で渡す
pub fn score_pro_ban(input: &ProScoreInput) -> Option<Scored> {
    if input.games <= 0.0 {
        return None;
    }
    Some(Scored {
        score: clamp01(input.presence),
        reasons: vec![pro_detail(input)],
        insufficient: false,
    })
}

fn pro_detail(input: &ProScoreInput) -> String {
    format!(
        "プロ プレゼンス{}(ピック{}・BAN{} / {}試合)",
        format_rate(input.presence),
        format_games(input.picks),
        format_games(input.bans),
        format_games(input.games)
    )
}
#[cfg(test)]
mod tests {
    use super::*;

    fn sample(win_rate: f64, games: f64, weight: f64, reason: &str) -> WinSample {
        WinSample {
            win_rate,
            games,
            weight,
            reason: reason.to_string(),
        }
    }

    fn approx(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-12,
            "actual={actual} expected={expected}"
        );
    }

    #[test]
    fn 勝率の標本が無い_重みが_0_ならスコアを出さない() {
        assert_eq!(score_win_samples(&[], WinKind::Pair), None);
        let zero = [sample(0.6, 1000.0, 0.0, "x")];
        assert_eq!(score_win_samples(&zero, WinKind::Pair), None);
    }

    #[test]
    fn 勝率はベイズ平均で寄せてから_45_から_55_を_0_から_1_にする() {
        // (0.6*1000 + 0.5*100) / 1100 = 0.59090909…、(0.5909… - 0.45) / 0.1 = 1.409… → 1 に切り詰め
        let high = score_win_samples(&[sample(0.6, 1000.0, 1.0, "a")], WinKind::Pair).unwrap();
        assert_eq!(high.score, 1.0);
        // (0.5*1000 + 0.5*100) / 1100 = 0.5 → 0.5
        let mid = score_win_samples(&[sample(0.5, 1000.0, 1.0, "a")], WinKind::Pair).unwrap();
        approx(mid.score, 0.5);
        // 試合数が少なければ 50% に寄る: (0.8*10 + 0.5*100) / 110 = 0.5272…
        let few = score_win_samples(&[sample(0.8, 10.0, 1.0, "a")], WinKind::Pair).unwrap();
        approx(few.score, ((0.8 * 10.0 + 0.5 * 100.0) / 110.0 - 0.45) / 0.1);
    }

    #[test]
    fn 試合数が閾値未満なら理由の末尾にサンプル不足を付ける() {
        let pair = score_win_samples(&[sample(0.55, 49.0, 1.0, "対戦")], WinKind::Pair).unwrap();
        assert!(pair.insufficient);
        assert_eq!(pair.reasons, vec!["対戦", "サンプル不足"]);

        let enough = score_win_samples(&[sample(0.55, 50.0, 1.0, "対戦")], WinKind::Pair).unwrap();
        assert!(!enough.insufficient);

        // メタの閾値は 200
        let meta = score_win_samples(&[sample(0.55, 199.0, 1.0, "メタ")], WinKind::Meta).unwrap();
        assert!(meta.insufficient);
    }

    #[test]
    fn 複数の標本は重みで平均する() {
        let samples = [sample(0.6, 1000.0, 3.0, "a"), sample(0.4, 1000.0, 1.0, "b")];
        let scored = score_win_samples(&samples, WinKind::Pair).unwrap();
        // a は 1、b は 0(切り詰め)。重み 3:1 で 0.75
        approx(scored.score, 0.75);
        assert_eq!(scored.reasons, vec!["a", "b"]);
    }

    #[test]
    fn ピックのメタは勝率_0_7_とティア_0_3_で出す() {
        let scored = score_pick_meta(&PickMetaInput {
            win_rate: 0.55,
            games: 10_000.0,
            tier_rank: 1.0,
        })
        .unwrap();
        assert_eq!(scored.reasons, vec!["勝率55.0%(10,000試合) ティア1"]);
        // ベイズ平均 (0.55*10000 + 0.5*300) / 10300 を 45%→0、55%→1 にし、勝率 0.7 + ティア 1 の 0.3
        approx(
            scored.score,
            0.7 * (((0.55 * 10_000.0 + 0.5 * 300.0) / 10_300.0 - 0.45) / 0.1) + 0.3,
        );
    }

    #[test]
    fn ティアが範囲外なら勝率だけで評価する() {
        let scored = score_pick_meta(&PickMetaInput {
            win_rate: 0.5,
            games: 10_000.0,
            tier_rank: 6.0,
        })
        .unwrap();
        approx(
            scored.score,
            ((0.5 * 10_000.0 + 0.5 * 300.0) / 10_300.0 - 0.45) / 0.1,
        );
        assert_eq!(scored.reasons, vec!["勝率50.0%(10,000試合) ティア6"]);
    }

    #[test]
    fn banのメタは勝率_ティア_ban率で出し_ロール名を理由に付ける() {
        let scored = score_ban_meta(&BanMetaInput {
            win_rate: 0.5,
            games: 10_000.0,
            tier_rank: 3.0,
            ban_rate: 0.2,
            position_label: "ミッド",
        })
        .unwrap();
        assert_eq!(
            scored.reasons,
            vec!["ミッド 勝率50.0%(10,000試合) ティア3 BAN率20.0%"]
        );
        let wins = ((0.5 * 10_000.0 + 0.5 * 300.0) / 10_300.0 - 0.45) / 0.1;
        approx(scored.score, 0.5 * wins + 0.3 * 0.5 + 0.2 * 0.2);
    }

    #[test]
    fn ロール未確定の印は理由の先頭の説明に付け_サンプル不足は末尾に戻す() {
        let scored = Scored {
            score: 0.5,
            reasons: vec!["対 A".into(), "対 B".into(), "サンプル不足".into()],
            insufficient: true,
        };
        let marked = mark_role_uncertain(scored);
        assert_eq!(
            marked.reasons,
            vec!["ロール未確定のため割合で加重。対 A", "対 B", "サンプル不足"]
        );
        assert!(marked.insufficient);
    }

    #[test]
    fn プール外は_0_手動登録は_0_6_習熟度は試合数と勝率で出す() {
        assert_eq!(
            score_pool(None),
            Scored {
                score: 0.0,
                reasons: vec!["プール外".into()],
                insufficient: false
            }
        );

        let manual = score_pool(Some(&PoolScoreInput {
            games: None,
            win_rate: None,
        }));
        assert_eq!(manual.score, 0.6);
        assert_eq!(manual.reasons, vec!["プールに登録済み"]);

        // 片方だけ無い入力も手動登録として扱う
        let half = score_pool(Some(&PoolScoreInput {
            games: Some(40.0),
            win_rate: None,
        }));
        assert_eq!(half.score, 0.6);

        let strong = score_pool(Some(&PoolScoreInput {
            games: Some(60.0),
            win_rate: Some(0.6),
        }));
        assert_eq!(strong.score, 1.0);
        assert_eq!(strong.reasons, vec!["プール 勝率60.0%(60試合)"]);

        // 習熟度 3/30 = 0.1 を 0.5、勝率(ベイズ平均 0.5 → 0.5)を 0.5 で重み付け
        let few = score_pool(Some(&PoolScoreInput {
            games: Some(3.0),
            win_rate: Some(0.5),
        }));
        approx(few.score, 0.3);
    }

    #[test]
    fn プロのピックはプレゼンス_0_6_と勝率_0_4_で出し_ピック_15_未満はサンプル不足() {
        let input = ProScoreInput {
            presence: 0.7,
            picks: 40.0,
            bans: 30.0,
            games: 100.0,
            win_rate: Some(0.6),
        };
        let scored = score_pro_pick(&input).unwrap();
        // ベイズ平均 (0.6*40 + 0.5*30) / 70 = 0.557… は 55% を超えるので勝率側は 1
        approx(scored.score, 0.6 * 0.7 + 0.4 * 1.0);
        assert_eq!(
            scored.reasons,
            vec!["プロ プレゼンス70.0%(ピック40・BAN30 / 100試合) 勝率60.0%"]
        );
        assert!(!scored.insufficient);

        let few = score_pro_pick(&ProScoreInput {
            picks: 14.0,
            ..input
        })
        .unwrap();
        assert!(few.insufficient);
        assert_eq!(few.reasons.last().map(String::as_str), Some("サンプル不足"));
    }

    #[test]
    fn プロのピックは勝率が無ければプレゼンスだけで出す() {
        let scored = score_pro_pick(&ProScoreInput {
            presence: 0.4,
            picks: 0.0,
            bans: 10.0,
            games: 50.0,
            win_rate: None,
        })
        .unwrap();
        assert_eq!(scored.score, 0.4);
        assert_eq!(
            scored.reasons,
            vec![
                "プロ プレゼンス40.0%(ピック0・BAN10 / 50試合)",
                "サンプル不足"
            ]
        );
    }

    #[test]
    fn プロは試合数が_0_以下ならスコアを出さず_banはプレゼンスだけを使う() {
        let none = ProScoreInput {
            presence: 0.5,
            picks: 1.0,
            bans: 1.0,
            games: 0.0,
            win_rate: Some(0.5),
        };
        assert_eq!(score_pro_pick(&none), None);
        assert_eq!(score_pro_ban(&none), None);

        let ban = score_pro_ban(&ProScoreInput {
            presence: 1.4,
            picks: 20.0,
            bans: 40.0,
            games: 100.0,
            win_rate: None,
        })
        .unwrap();
        assert_eq!(ban.score, 1.0);
        assert_eq!(
            ban.reasons,
            vec!["プロ プレゼンス140.0%(ピック20・BAN40 / 100試合)"]
        );
    }
}
