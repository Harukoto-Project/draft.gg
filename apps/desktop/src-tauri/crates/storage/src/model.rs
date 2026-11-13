//! 保存するデータの形。JSON は TS 版(`@draftgg/shared`)と同じ camelCase。

use std::collections::HashMap;

use draftgg_engine::Position;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

/// プレイヤー数の上限(チーム 5 人 + 余裕)
pub const MAX_PROFILES: usize = 30;
/// 1 プレイヤーのプールの最大件数(チャンピオン × ロール)
pub const MAX_POOL_ENTRIES: usize = 100;
pub const MAX_TEAMS: usize = 10;
pub const MAX_DRAFTS: usize = 50;
pub const DRAFT_NOTE_MAX_LENGTH: usize = 200;
pub const ID_MAX_LENGTH: usize = 64;

/// OP.GG のプロフィール取得で指定できるリージョン
pub const RIOT_REGIONS: [&str; 16] = [
    "JP", "KR", "NA", "EUW", "EUNE", "OCE", "BR", "LAN", "LAS", "RU", "TR", "SG", "PH", "TW", "TH",
    "VN",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolSource {
    Opgg,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolEntry {
    pub champion_id: String,
    pub position: Position,
    pub source: PoolSource,
    /// 手動で足したものは None
    pub games: Option<u64>,
    pub win_rate: Option<f64>,
    /// true のときは、プールに無いものとして扱う
    pub excluded: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub display_name: String,
    pub riot_id: Option<String>,
    pub region: Option<String>,
    pub roles: Vec<Position>,
    /// 最後に OP.GG から取得した日時(ISO 8601)。未同期なら None
    pub synced_at: Option<String>,
    pub pool: Vec<PoolEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub display_name: String,
    pub riot_id: Option<String>,
    pub region: Option<String>,
    pub roles: Vec<Position>,
}

/// 更新で渡す項目。渡さない項目は変えない。`riot_id` と `region` は null で消せる
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePatch {
    pub display_name: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    pub riot_id: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    pub region: Option<Option<String>>,
    pub roles: Option<Vec<Position>>,
}

/// 「項目なし」と「null」を区別する(`Some(None)` が null)
fn nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

/// ロールごとのプレイヤー id。空きのロールは持たない
pub type TeamMembers = HashMap<Position, String>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub members: TeamMembers,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TeamInput {
    pub name: String,
    pub members: TeamMembers,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub struct TeamPatch {
    pub name: Option<String>,
    /// 渡したときは、割り当て全体を置き換える
    pub members: Option<TeamMembers>,
}

/// 保存したドラフト。`state` は画面側(zod)が検証した形のまま持ち、Rust では中身を見ない
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedDraft {
    pub id: String,
    pub state: Value,
    pub note: String,
    /// ISO 8601
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct SavedDraftInput {
    pub state: Value,
    #[serde(default)]
    pub note: String,
}

/// ファイルに保存する全体
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub(crate) struct UserData {
    #[serde(default)]
    pub profiles: Vec<Profile>,
    #[serde(default)]
    pub teams: Vec<Team>,
    /// 保存した順(古い順)。一覧は新しい順に返す
    #[serde(default)]
    pub drafts: Vec<SavedDraft>,
}
