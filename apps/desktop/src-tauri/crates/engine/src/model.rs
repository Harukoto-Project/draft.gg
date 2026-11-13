//! api の `GET /api/snapshot` と、画面からの入力の形。JSON は TS 版(`@draftgg/shared`)と同じ camelCase。
//! 統計の数値は TS と同じ浮動小数の計算にそろえるため、試合数も f64 で持つ。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Position {
    Top,
    Jungle,
    Mid,
    Adc,
    Support,
}

impl Position {
    /// 計算の順序(TS の `POSITIONS`)
    pub const ALL: [Position; 5] = [
        Position::Top,
        Position::Jungle,
        Position::Mid,
        Position::Adc,
        Position::Support,
    ];

    /// 理由文に出す日本語のロール名
    pub fn label(self) -> &'static str {
        match self {
            Position::Top => "トップ",
            Position::Jungle => "ジャングル",
            Position::Mid => "ミッド",
            Position::Adc => "ボット",
            Position::Support => "サポート",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Blue,
    Red,
}

impl Side {
    pub const ALL: [Side; 2] = [Side::Blue, Side::Red];

    pub fn opposite(self) -> Side {
        match self {
            Side::Blue => Side::Red,
            Side::Red => Side::Blue,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DamageType {
    Ad,
    Ap,
    Mixed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Preset {
    Solo,
    Team,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionType {
    Ban,
    Pick,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DraftFormat {
    Ranked,
    Tournament,
}

// ---- 統計スナップショット ----

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionRef {
    pub id: String,
    pub name_ja: String,
    pub name_en: String,
    pub numeric_key: u32,
    pub damage_type: Option<DamageType>,
    /// Data Dragon のタグ(Tank / Fighter など)。未取得なら None
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaStat {
    pub champion_id: String,
    pub position: Position,
    pub games: f64,
    pub win_rate: f64,
    pub pick_rate: f64,
    pub ban_rate: f64,
    pub role_rate: f64,
    /// OP.GG のティア(1=強い … 5=弱い)
    pub tier_rank: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchupStat {
    pub champion_id: String,
    pub position: Position,
    pub opponent_id: String,
    pub games: f64,
    /// champion_id 側の勝率
    pub win_rate: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynergyStat {
    pub champion_id: String,
    pub position: Position,
    pub ally_id: String,
    pub ally_position: Position,
    pub games: f64,
    pub win_rate: f64,
    pub score: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProStat {
    pub champion_id: String,
    pub position: Position,
    /// その scope の試合数(プレゼンスの分母)
    pub games: f64,
    pub picks: f64,
    /// チャンピオン全体の BAN 数。ロール別の行に同じ値を置く
    pub bans: f64,
    pub presence: f64,
    pub win_rate: Option<f64>,
    pub early_pick_rate: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSnapshot {
    pub patch: Option<String>,
    /// ランク帯(いまは `diamond_plus` だけ)。増えても読めるよう文字列のまま持つ
    pub tier: String,
    pub champions: Vec<ChampionRef>,
    pub meta: Vec<MetaStat>,
    pub matchups: Vec<MatchupStat>,
    pub synergies: Vec<SynergyStat>,
    /// scope major のプロ統計。未集計なら空
    pub pro: Vec<ProStat>,
}

// ---- ドラフト ----

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Assignment {
    pub top: Option<String>,
    pub jungle: Option<String>,
    pub mid: Option<String>,
    pub adc: Option<String>,
    pub support: Option<String>,
}

impl Assignment {
    pub fn get(&self, position: Position) -> Option<&str> {
        let slot = match position {
            Position::Top => &self.top,
            Position::Jungle => &self.jungle,
            Position::Mid => &self.mid,
            Position::Adc => &self.adc,
            Position::Support => &self.support,
        };
        slot.as_deref()
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Assignments {
    pub blue: Assignment,
    pub red: Assignment,
}

impl Assignments {
    pub fn side(&self, side: Side) -> &Assignment {
        match side {
            Side::Blue => &self.blue,
            Side::Red => &self.red,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftAction {
    pub step: u32,
    #[serde(rename = "type")]
    pub kind: ActionType,
    pub side: Side,
    pub champion_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct MyRole {
    pub side: Side,
    pub position: Position,
}

/// 計算に使う部分だけ。`team`(ロールとプレイヤーの対応)は M2 の計算で使わないため読み飛ばす。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftState {
    pub format: DraftFormat,
    pub my_side: Side,
    pub actions: Vec<DraftAction>,
    pub assignments: Assignments,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub me: Option<MyRole>,
}

// ---- プール ----

/// 提案に渡すプール 1 件。手動登録は games と win_rate が None。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolHintEntry {
    pub champion_id: String,
    pub games: Option<f64>,
    pub win_rate: Option<f64>,
}

/// ロールごとの、そのロールを担当するプレイヤーのプール
pub type PoolHints = HashMap<Position, Vec<PoolHintEntry>>;

// ---- 提案の結果 ----

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Factors {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub counter: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub synergy: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pro: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pool: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub composition: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationCandidate {
    pub champion_id: String,
    pub name_ja: String,
    /// BAN ではメタの強さを採ったロール。ピックでは所属するロール。
    pub position: Position,
    pub score: f64,
    pub factors: Factors,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PickRecommendations {
    pub position: Position,
    pub candidates: Vec<RecommendationCandidate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecommendationResponse {
    pub patch: Option<String>,
    pub tier: String,
    pub preset: Preset,
    pub picks: Vec<PickRecommendations>,
    pub bans: Vec<RecommendationCandidate>,
}
