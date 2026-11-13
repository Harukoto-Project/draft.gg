//! 味方の構成を補うか。AD / AP のバランスと、前衛(タンク・ファイター)の量で見る。

use crate::format::clamp01;
use crate::model::{ChampionRef, DamageType};
use crate::score::Scored;

/// 5人構成でダメージが 2:3 に割れたときの、少ない側の割合。これ以上なら偏りなしとみなす
const BALANCED_MINORITY_SHARE: f64 = 0.4;
/// 味方の偏りを理由に出す、少ない側の割合の上限
const SKEWED_MINORITY_SHARE: f64 = 0.25;

/// 前衛の量。タンクは 1、ファイターは 0.6。合計がこの値以上なら十分とみなす
const FRONTLINE_TARGET: f64 = 1.6;
const TANK_FRONTLINE: f64 = 1.0;
const FIGHTER_FRONTLINE: f64 = 0.6;
/// 前衛が足りないとみなす味方の合計
const FRONTLINE_SHORT: f64 = 0.6;

const DAMAGE_WEIGHT: f64 = 0.6;
const FRONTLINE_WEIGHT: f64 = 0.4;

#[derive(Clone, Copy)]
struct Shares {
    ad: f64,
    ap: f64,
}

/// AD と AP の量。複合は半分ずつ、未取得は数えない
fn damage_shares<'a>(champions: impl IntoIterator<Item = &'a ChampionRef>) -> Shares {
    let mut shares = Shares { ad: 0.0, ap: 0.0 };
    for champion in champions {
        match champion.damage_type {
            Some(DamageType::Ad) => shares.ad += 1.0,
            Some(DamageType::Ap) => shares.ap += 1.0,
            Some(DamageType::Mixed) => {
                shares.ad += 0.5;
                shares.ap += 0.5;
            }
            None => {}
        }
    }
    shares
}

fn minority_share(shares: Shares) -> f64 {
    let total = shares.ad + shares.ap;
    if total > 0.0 {
        shares.ad.min(shares.ap) / total
    } else {
        0.0
    }
}

/// 前衛の量。タンクは 1、ファイターは 0.6、それ以外は 0
pub fn frontline_value(champion: &ChampionRef) -> f64 {
    let tags = champion.tags.as_deref().unwrap_or(&[]);
    if tags.iter().any(|tag| tag == "Tank") {
        TANK_FRONTLINE
    } else if tags.iter().any(|tag| tag == "Fighter") {
        FIGHTER_FRONTLINE
    } else {
        0.0
    }
}

struct Part {
    score: f64,
    reason: Option<String>,
}

fn damage_label(damage: DamageType) -> &'static str {
    match damage {
        DamageType::Ad => "AD",
        _ => "AP",
    }
}

fn damage_score(allies: &[&ChampionRef], candidate: &ChampionRef) -> Option<Part> {
    let candidate_damage = candidate.damage_type?;
    let before = damage_shares(allies.iter().copied());
    if before.ad + before.ap == 0.0 {
        return None;
    }
    let after = damage_shares(allies.iter().copied().chain(std::iter::once(candidate)));

    let mut reason = None;
    if minority_share(before) < SKEWED_MINORITY_SHARE {
        let (majority, minority) = if before.ad >= before.ap {
            (DamageType::Ad, DamageType::Ap)
        } else {
            (DamageType::Ap, DamageType::Ad)
        };
        if candidate_damage == minority {
            reason = Some(format!(
                "味方は{}寄りのため、{}を足して物理・魔法のバランスを補える",
                damage_label(majority),
                damage_label(minority)
            ));
        } else if candidate_damage == majority {
            reason = Some(format!(
                "味方は{}寄りで、さらに偏る",
                damage_label(majority)
            ));
        }
    }
    Some(Part {
        score: clamp01(minority_share(after) / BALANCED_MINORITY_SHARE),
        reason,
    })
}

fn frontline_score(allies: &[&ChampionRef], candidate: &ChampionRef) -> Option<Part> {
    candidate.tags.as_ref()?;
    let team = allies
        .iter()
        .fold(0.0, |sum, ally| sum + frontline_value(ally));
    let added = frontline_value(candidate);
    let reason = if team < FRONTLINE_SHORT && added >= FIGHTER_FRONTLINE {
        Some("前衛(タンク・ファイター)が不足している味方構成を補える".to_string())
    } else {
        None
    };
    Some(Part {
        score: clamp01((team + added) / FRONTLINE_TARGET),
        reason,
    })
}

/// 味方の構成を補うか。AD / AP のバランスと、前衛(タンク・ファイター)の量で見る。
/// 味方のピックが無いとき、候補の属性が無いときは計算しない(None)。
pub fn score_composition(
    allies: &[&ChampionRef],
    candidate: Option<&ChampionRef>,
) -> Option<Scored> {
    let candidate = candidate?;
    if allies.is_empty() {
        return None;
    }
    let mut parts: Vec<(f64, Part)> = Vec::with_capacity(2);
    if let Some(damage) = damage_score(allies, candidate) {
        parts.push((DAMAGE_WEIGHT, damage));
    }
    if let Some(frontline) = frontline_score(allies, candidate) {
        parts.push((FRONTLINE_WEIGHT, frontline));
    }
    let total_weight = parts.iter().fold(0.0, |sum, (weight, _)| sum + weight);
    if total_weight <= 0.0 {
        return None;
    }

    Some(Scored {
        score: parts.iter().fold(0.0, |sum, (weight, part)| {
            sum + (weight / total_weight) * part.score
        }),
        reasons: parts
            .into_iter()
            .filter_map(|(_, part)| part.reason)
            .collect(),
        insufficient: false,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::DamageType;

    fn champion(id: &str, damage_type: Option<DamageType>, tags: Option<&[&str]>) -> ChampionRef {
        ChampionRef {
            id: id.to_string(),
            name_ja: id.to_string(),
            name_en: id.to_string(),
            numeric_key: 1,
            damage_type,
            tags: tags.map(|tags| tags.iter().map(|tag| tag.to_string()).collect()),
        }
    }

    fn ad() -> ChampionRef {
        champion("Ad", Some(DamageType::Ad), Some(&["Marksman"]))
    }
    fn ad2() -> ChampionRef {
        champion("Ad2", Some(DamageType::Ad), Some(&["Assassin"]))
    }
    fn ap() -> ChampionRef {
        champion("Ap", Some(DamageType::Ap), Some(&["Mage"]))
    }
    fn mixed() -> ChampionRef {
        champion("Mixed", Some(DamageType::Mixed), Some(&["Mage"]))
    }
    fn tank() -> ChampionRef {
        champion("Tank", Some(DamageType::Ap), Some(&["Tank"]))
    }
    fn fighter() -> ChampionRef {
        champion("Fighter", Some(DamageType::Ad), Some(&["Fighter"]))
    }

    fn has(scored: &Option<Scored>, reason: &str) -> bool {
        scored
            .as_ref()
            .is_some_and(|scored| scored.reasons.iter().any(|r| r == reason))
    }

    fn score(scored: &Option<Scored>) -> f64 {
        scored.as_ref().expect("スコアが出るはず").score
    }

    #[test]
    fn タンクは_1_ファイターは_0_6_それ以外は_0() {
        assert_eq!(frontline_value(&tank()), 1.0);
        assert_eq!(frontline_value(&fighter()), 0.6);
        assert_eq!(frontline_value(&ad()), 0.0);
        assert_eq!(frontline_value(&champion("None", None, None)), 0.0);
    }

    #[test]
    fn タンクとファイターの両方なら大きいほう() {
        let both = champion("Both", Some(DamageType::Ad), Some(&["Fighter", "Tank"]));
        assert_eq!(frontline_value(&both), 1.0);
    }

    #[test]
    fn 味方のピックが無ければ計算しない() {
        assert!(score_composition(&[], Some(&ap())).is_none());
    }

    #[test]
    fn 候補の情報が無ければ計算しない() {
        let ad = ad();
        assert!(score_composition(&[&ad], None).is_none());
    }

    #[test]
    fn 味方が_ad_に偏っているとき_ap_の候補のほうが高い() {
        let (a, b) = (ad(), ad2());
        let allies = [&a, &b];
        let with_ap = score_composition(&allies, Some(&ap()));
        let with_ad = score_composition(
            &allies,
            Some(&champion("Ad3", Some(DamageType::Ad), Some(&["Marksman"]))),
        );

        assert!(score(&with_ap) > score(&with_ad));
        assert!(has(
            &with_ap,
            "味方はAD寄りのため、APを足して物理・魔法のバランスを補える"
        ));
        assert!(has(&with_ad, "味方はAD寄りで、さらに偏る"));
    }

    #[test]
    fn 複合は_ad_ap_を半分ずつ数える() {
        let (a, b) = (ad(), ad2());
        let allies = [&a, &b];
        let with_mixed = score_composition(&allies, Some(&mixed()));
        let with_ad = score_composition(
            &allies,
            Some(&champion("Ad3", Some(DamageType::Ad), Some(&["Marksman"]))),
        );
        let with_ap = score_composition(&allies, Some(&ap()));

        assert!(score(&with_mixed) > score(&with_ad));
        assert!(score(&with_mixed) < score(&with_ap));
    }

    #[test]
    fn 前衛がいない味方にはタンクの候補のほうが高い() {
        let (a, p) = (ad(), ap());
        let allies = [&a, &p];
        let with_tank = score_composition(&allies, Some(&tank()));
        let with_mage = score_composition(&allies, Some(&mixed()));

        assert!(score(&with_tank) > score(&with_mage));
        assert!(has(
            &with_tank,
            "前衛(タンク・ファイター)が不足している味方構成を補える"
        ));
    }

    #[test]
    fn 前衛が足りているときは前衛の候補に理由を付けない() {
        let (t, f, p) = (tank(), fighter(), ap());
        let result = score_composition(
            &[&t, &f, &p],
            Some(&champion("Another", Some(DamageType::Ad), Some(&["Tank"]))),
        );
        assert_eq!(result.unwrap().reasons, Vec::<String>::new());
    }

    #[test]
    fn ダメージの種類が未取得なら前衛だけで評価する() {
        let a = ad();
        let result = score_composition(&[&a], Some(&champion("Unknown", None, Some(&["Tank"]))));
        assert!((score(&result) - 1.0 / 1.6).abs() < 1e-12);
    }

    #[test]
    fn タグが無ければダメージのバランスだけで評価する() {
        let a = ad();
        let result =
            score_composition(&[&a], Some(&champion("NoTags", Some(DamageType::Ap), None)));
        assert_eq!(score(&result), 1.0);
    }

    #[test]
    fn ダメージもタグも無ければ計算しない() {
        let a = ad();
        assert!(score_composition(&[&a], Some(&champion("Nothing", None, None))).is_none());
    }

    #[test]
    fn スコアは_0_から_1_に収まる() {
        let (a, b) = (ad(), ad2());
        let allies = [&a, &b];
        let worst = score_composition(
            &allies,
            Some(&champion("Worst", Some(DamageType::Ad), None)),
        );
        let best = score_composition(&allies, Some(&tank()));
        assert!(score(&worst) >= 0.0);
        assert!(score(&best) <= 1.0);
    }
}
